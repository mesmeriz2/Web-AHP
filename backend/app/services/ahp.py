from typing import Dict, List, Tuple

import numpy as np

from app.core.settings import get_settings

settings = get_settings()


def validate_matrix(matrix: List[List[float]]) -> int:
    if not matrix:
        raise ValueError("matrix is empty")
    size = len(matrix)
    for row in matrix:
        if len(row) != size:
            raise ValueError("matrix is not square")
        for value in row:
            if value <= 0:
                raise ValueError("matrix contains non-positive value")
    return size


def compute_priority_vector(matrix: List[List[float]]) -> List[float]:
    size = validate_matrix(matrix)
    arr = np.array(matrix, dtype=float)
    vector = np.ones(size, dtype=float) / size
    for _ in range(settings.ahp_max_iter):
        next_vector = arr.dot(vector)
        next_vector = next_vector / next_vector.sum()
        if np.linalg.norm(next_vector - vector) < settings.ahp_tolerance:
            vector = next_vector
            break
        vector = next_vector
    return vector.tolist()


def compute_consistency(
    matrix: List[List[float]],
    ri_table: Dict[int, float],
) -> Tuple[float, float]:
    size = validate_matrix(matrix)
    if size < 3:
        return 0.0, 0.0
    weights = np.array(compute_priority_vector(matrix), dtype=float)
    arr = np.array(matrix, dtype=float)
    aw = arr.dot(weights)
    lambda_max = float((aw / weights).mean())
    ci = (lambda_max - size) / (size - 1)
    ri = ri_table.get(size)
    if ri is None or ri == 0:
        return float(ci), 0.0
    cr = ci / ri
    return float(ci), float(cr)


def aggregate_matrices(matrices: List[List[List[float]]]) -> List[List[float]]:
    if not matrices:
        raise ValueError("no matrices to aggregate")
    size = validate_matrix(matrices[0])
    product = np.ones((size, size), dtype=float)
    for matrix in matrices:
        validate_matrix(matrix)
        product *= np.array(matrix, dtype=float)
    geom_mean = product ** (1.0 / len(matrices))
    return geom_mean.tolist()
