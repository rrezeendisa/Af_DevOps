import csv
from itertools import product
from pathlib import Path

from ml.constants import FEATURES

DATASET_PATH = Path(__file__).resolve().parents[1] / "data" / "synthetic_competencies.csv"


def label_from_sum(total: int) -> str:
    """Aplica os limites de média definidos para rotular a base sintética."""
    if total <= 7:  # média até 7/3 (aproximadamente 2,33)
        return "INICIANTE"
    if total <= 10:  # médias entre os limites aproximados 2,33 e 3,67
        return "INTERMEDIARIO"
    return "AVANCADO"  # média a partir de 11/3 (aproximadamente 3,67)


def generate_dataset(output_path: Path = DATASET_PATH) -> Path:
    """Grava as 125 combinações possíveis das três competências em CSV."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=[*FEATURES, "nivel"])
        writer.writeheader()
        for values in product(range(1, 6), repeat=len(FEATURES)):
            row = dict(zip(FEATURES, values, strict=True))
            row["nivel"] = label_from_sum(sum(values))
            writer.writerow(row)
    return output_path


if __name__ == "__main__":
    dataset_path = generate_dataset()
    print(f"Base sintética gerada em {dataset_path} (125 registros).")
