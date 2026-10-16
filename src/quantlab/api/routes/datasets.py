import io
import logging
import re
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile

from quantlab.api.schemas import (
    BatchFetchDatasetsRequest,
    BatchFetchDatasetsResponse,
    DatasetInfo,
    DatasetListResponse,
    DatasetUploadResponse,
    FailedSymbolDTO,
    FetchDatasetRequest,
)
from quantlab.config import settings
from quantlab.data.csv_loader import (
    fetch_ohlcv_from_yfinance,
    load_bars_from_csv,
    normalize_dataframe_columns,
    save_bars_to_csv,
)
from quantlab.data.models import Bar
from quantlab.data.validation import validate_bar

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/datasets", tags=["Datasets"])

DATA_DIR = settings.data_dir


@router.get("", response_model=DatasetListResponse)
def list_datasets() -> DatasetListResponse:
    """List available historical datasets and their metadata."""
    datasets: list[DatasetInfo] = []

    if DATA_DIR.exists() and DATA_DIR.is_dir():
        for file in sorted(DATA_DIR.glob("*.csv")):
            try:
                bars = load_bars_from_csv(file)
                if bars:
                    symbol = (
                        "RELIANCE"
                        if "reliance" in file.stem.lower()
                        else file.stem.upper().replace("_DAILY", "")
                    )
                    datasets.append(
                        DatasetInfo(
                            filename=file.name,
                            symbol=symbol,
                            bars_count=len(bars),
                            start_date=bars[0].timestamp.strftime("%Y-%m-%d"),
                            end_date=bars[-1].timestamp.strftime("%Y-%m-%d"),
                            file_size_bytes=file.stat().st_size,
                        )
                    )
            except (ValueError, TypeError, OSError) as error:
                logger.warning("Skipping unparseable dataset %s: %s", file, error)
                continue

    return DatasetListResponse(datasets=datasets)


@router.post("/upload", response_model=DatasetUploadResponse)
async def upload_dataset(file: UploadFile) -> DatasetUploadResponse:
    """Upload, validate, and store a custom OHLCV CSV dataset."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Uploaded file must be a .csv file.",
        )

    safe_name = re.sub(r"[^\w\-.]", "_", Path(file.filename).name).lower()
    if not safe_name.endswith(".csv"):
        safe_name = f"{safe_name}.csv"

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    target_path = DATA_DIR / safe_name

    # Temporary staging or in-memory verification
    try:
        buffer = io.StringIO(content.decode("utf-8", errors="replace"))
        df = pd.read_csv(buffer)
        df = normalize_dataframe_columns(df)

        required = {"timestamp", "open", "high", "low", "close", "volume"}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"CSV missing required columns: {sorted(missing)}")

        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values(by="timestamp").reset_index(drop=True)
        df = df.drop_duplicates(subset=["timestamp"], keep="last")

        bars: list[Bar] = []
        for row in df.itertuples(index=False):
            ts = row.timestamp.to_pydatetime()
            if ts.tzinfo is not None:
                ts = ts.replace(tzinfo=None)
            bar = Bar(
                timestamp=ts,
                open=float(row.open),
                high=float(row.high),
                low=float(row.low),
                close=float(row.close),
                volume=float(row.volume),
            )
            validate_bar(bar)
            bars.append(bar)

        if len(bars) < 5:
            raise ValueError(
                f"Dataset contains too few valid bars ({len(bars)}, minimum is 5)."
            )

        # Save validated data
        save_bars_to_csv(bars, target_path)

    except Exception as e:
        logger.error("Dataset validation failed for %s: %s", safe_name, e)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid dataset format: {e}",
        ) from e

    symbol = safe_name.replace(".csv", "").replace("_daily", "").upper()
    info = DatasetInfo(
        filename=target_path.name,
        symbol=symbol,
        bars_count=len(bars),
        start_date=bars[0].timestamp.strftime("%Y-%m-%d"),
        end_date=bars[-1].timestamp.strftime("%Y-%m-%d"),
        file_size_bytes=target_path.stat().st_size,
    )

    return DatasetUploadResponse(
        message=f"Successfully uploaded and validated {len(bars)} market bars for {symbol}.",
        dataset=info,
    )


@router.post("/fetch", response_model=DatasetUploadResponse)
def fetch_dataset(request: FetchDatasetRequest) -> DatasetUploadResponse:
    """Fetch daily market data from Yahoo Finance, validate, and store it locally."""
    clean_symbol = request.symbol.strip().upper()

    try:
        bars = fetch_ohlcv_from_yfinance(clean_symbol, period=request.period)
    except Exception as e:
        logger.error("Failed to fetch market data for %s: %s", clean_symbol, e)
        raise HTTPException(
            status_code=400,
            detail=f"Could not download market data for symbol '{clean_symbol}': {e}",
        ) from e

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    safe_symbol = re.sub(r"[^\w\-]", "_", clean_symbol).lower()
    filename = f"{safe_symbol}_daily.csv"
    target_path = DATA_DIR / filename

    save_bars_to_csv(bars, target_path)

    info = DatasetInfo(
        filename=filename,
        symbol=clean_symbol,
        bars_count=len(bars),
        start_date=bars[0].timestamp.strftime("%Y-%m-%d"),
        end_date=bars[-1].timestamp.strftime("%Y-%m-%d"),
        file_size_bytes=target_path.stat().st_size,
    )

    return DatasetUploadResponse(
        message=f"Successfully downloaded and validated {len(bars)} market bars for {clean_symbol}.",
        dataset=info,
    )


@router.post("/fetch-batch", response_model=BatchFetchDatasetsResponse)
def fetch_batch_datasets(
    request: BatchFetchDatasetsRequest,
) -> BatchFetchDatasetsResponse:
    """Download multiple ticker datasets in batch from Yahoo Finance."""
    successful: list[DatasetInfo] = []
    failed: list[FailedSymbolDTO] = []

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    for raw_symbol in request.symbols:
        clean_symbol = raw_symbol.strip().upper()
        if not clean_symbol:
            continue
        try:
            bars = fetch_ohlcv_from_yfinance(clean_symbol, period=request.period)
            safe_symbol = re.sub(r"[^\w\-]", "_", clean_symbol).lower()
            filename = f"{safe_symbol}_daily.csv"
            target_path = DATA_DIR / filename
            save_bars_to_csv(bars, target_path)

            info = DatasetInfo(
                filename=filename,
                symbol=clean_symbol,
                bars_count=len(bars),
                start_date=bars[0].timestamp.strftime("%Y-%m-%d"),
                end_date=bars[-1].timestamp.strftime("%Y-%m-%d"),
                file_size_bytes=target_path.stat().st_size,
            )
            successful.append(info)
        except (ValueError, TypeError, OSError, RuntimeError, KeyError) as e:
            logger.warning("Batch fetch failed for %s: %s", clean_symbol, e)
            failed.append(FailedSymbolDTO(symbol=clean_symbol, error=str(e)))

    if not successful and failed:
        raise HTTPException(
            status_code=400,
            detail=f"All requested symbols failed to download: {[f.model_dump() for f in failed]}",
        )

    msg = f"Successfully downloaded {len(successful)} dataset(s)."
    if failed:
        msg += f" {len(failed)} symbol(s) could not be fetched."

    return BatchFetchDatasetsResponse(
        message=msg,
        datasets=successful,
        failed_symbols=failed,
    )
