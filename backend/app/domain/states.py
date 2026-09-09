from enum import StrEnum

from app.core.errors import ConflictError


class InspectionState(StrEnum):
    CREATED = "CREATED"
    CAPTURING = "CAPTURING"
    READY = "READY"
    INFERENCING = "INFERENCING"
    DECIDED = "DECIDED"
    RECAPTURE_REQUIRED = "RECAPTURE_REQUIRED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    CLOSED = "CLOSED"
    FAILED = "FAILED"


ALLOWED_TRANSITIONS: dict[InspectionState, set[InspectionState]] = {
    InspectionState.CREATED: {InspectionState.CAPTURING, InspectionState.FAILED},
    InspectionState.CAPTURING: {
        InspectionState.READY,
        InspectionState.FAILED,
    },
    InspectionState.READY: {
        InspectionState.CAPTURING,
        InspectionState.INFERENCING,
        InspectionState.FAILED,
    },
    InspectionState.INFERENCING: {
        InspectionState.DECIDED,
        InspectionState.RECAPTURE_REQUIRED,
        InspectionState.REVIEW_REQUIRED,
        InspectionState.FAILED,
    },
    InspectionState.DECIDED: {
        InspectionState.REVIEW_REQUIRED,
        InspectionState.CLOSED,
        InspectionState.FAILED,
    },
    InspectionState.RECAPTURE_REQUIRED: {
        InspectionState.CAPTURING,
        InspectionState.REVIEW_REQUIRED,
        InspectionState.FAILED,
    },
    InspectionState.REVIEW_REQUIRED: {
        InspectionState.RECAPTURE_REQUIRED,
        InspectionState.CLOSED,
        InspectionState.FAILED,
    },
    InspectionState.CLOSED: set(),
    InspectionState.FAILED: set(),
}


def ensure_transition(current: str, target: InspectionState) -> None:
    current_state = InspectionState(current)
    if current_state == target:
        return
    if target not in ALLOWED_TRANSITIONS[current_state]:
        raise ConflictError(
            f"质检任务不能从 {current_state.value} 转换到 {target.value}",
            current_state.value,
        )

