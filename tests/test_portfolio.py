import pytest

from quantlab.portfolio.manager import Portfolio
from quantlab.strategy.models import Signal


def test_portfolio_starts_flat():
    portfolio = Portfolio()

    assert portfolio.position.signal == Signal.FLAT
    assert portfolio.position.quantity == 0.0


def test_long_signal_creates_long_position():
    portfolio = Portfolio()

    position = portfolio.update(Signal.LONG, 10.0)

    assert position.signal == Signal.LONG
    assert position.quantity == 10.0


def test_short_signal_creates_short_position():
    portfolio = Portfolio()

    position = portfolio.update(Signal.SHORT, 10.0)

    assert position.signal == Signal.SHORT
    assert position.quantity == 10.0


def test_flat_signal_closes_position():
    portfolio = Portfolio()

    portfolio.update(Signal.LONG, 10.0)
    position = portfolio.update(Signal.FLAT, 10.0)

    assert position.signal == Signal.FLAT
    assert position.quantity == 0.0


def test_negative_quantity_is_rejected():
    portfolio = Portfolio()

    with pytest.raises(ValueError):
        portfolio.update(Signal.LONG, -1.0)