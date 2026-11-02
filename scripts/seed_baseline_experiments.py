"""Command-line utility to seed verified baseline demo experiments into QuantLab."""

import sys
from pathlib import Path

# Add project root to sys.path if running directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from quantlab.storage.demo_seeder import seed_demo_experiments


def main() -> None:
    print("Seeding QuantLab demo experiments into SQLite repository...")
    seeded = seed_demo_experiments(force=False)
    if not seeded:
        print("Demo experiments are already present. No duplicates created (idempotent).")
    else:
        print(f"Successfully seeded {len(seeded)} demo experiment(s):")
        for rec in seeded:
            print(f" - #{rec.id}: {rec.name} ({rec.strategy} on {rec.dataset}, {rec.total_trades} trades)")


if __name__ == "__main__":
    main()
