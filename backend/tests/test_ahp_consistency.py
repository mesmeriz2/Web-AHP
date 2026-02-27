import json
from pathlib import Path

from app.core.settings import get_ri_table
from app.services.ahp import compute_consistency


def test_consistency_index_and_ratio():
    fixture_path = Path(__file__).parent / "fixtures" / "ahp_example.json"
    data = json.loads(fixture_path.read_text(encoding="utf-8"))

    matrix = data["matrix"]
    expected_ci = data["expected_ci"]
    expected_cr = data["expected_cr"]
    tolerance = data["tolerance"]

    ri_table = get_ri_table()
    ci, cr = compute_consistency(matrix, ri_table)

    assert abs(ci - expected_ci) < tolerance
    assert abs(cr - expected_cr) < tolerance
