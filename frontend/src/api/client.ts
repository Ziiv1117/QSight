export type InspectionState =
  | "CREATED"
  | "CAPTURING"
  | "READY"
  | "INFERENCING"
  | "DECIDED"
  | "RECAPTURE_REQUIRED"
  | "REVIEW_REQUIRED"
  | "CLOSED"
  | "FAILED";

type ApiEnvelope<T> = {
  request_id: string;
  inspection_state: InspectionState | null;
  data: T;
  error_code: string | null;
  message: string;
};

export type WorkpieceCreateInput = {
  product_code: string;
  product_name: string;
  product_revision: string;
  batch_code: string;
  batch_source?: string;
  serial_no: string;
};

export type WorkpieceRecord = {
  workpiece_id: string;
  product_id: string;
  batch_id: string;
  product_code: string;
  batch_code: string;
  serial_no: string;
  created_at: string;
};

export type InspectionCreateInput = {
  workpiece_id: string;
  model_version_id?: string | null;
  view_recipe: string;
  expected_view_count: number;
};

export type InspectionSummary = {
  id: string;
  state: InspectionState;
  decision: string | null;
  view_recipe: string;
  expected_view_count: number;
  model_version_id: string | null;
  created_at: string;
  updated_at: string;
  serial_no: string;
  batch_code: string;
  product_code: string;
  view_count: number;
};

export type InspectionDetail = InspectionSummary & {
  workpiece_id: string;
  product_name: string;
  batch_source: string | null;
  views: Array<{
    view_id: string;
    view_name: string | null;
    image_path: string;
    sha256: string;
    mime_type: string;
    width: number;
    height: number;
    created_at: string;
  }>;
};

export type InspectionPage = {
  items: InspectionSummary[];
  page: number;
  page_size: number;
  total: number;
};

export class QSightApiError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string | null,
    public readonly requestId: string | null,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || envelope.error_code) {
    throw new QSightApiError(
      envelope.message || "本地服务请求失败",
      envelope.error_code,
      envelope.request_id,
    );
  }
  return envelope.data;
}

export function createWorkpiece(input: WorkpieceCreateInput) {
  return request<WorkpieceRecord>("/workpieces", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createInspection(input: InspectionCreateInput) {
  return request<InspectionDetail>("/inspections", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getInspection(inspectionId: string) {
  return request<InspectionDetail>(`/inspections/${inspectionId}`);
}

export function listInspections(page = 1, pageSize = 50) {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  return request<InspectionPage>(`/inspections?${query.toString()}`);
}

export function importInspectionView(
  inspectionId: string,
  viewId: string,
  viewName: string,
  image: File,
) {
  const form = new FormData();
  form.append("view_id", viewId);
  form.append("view_name", viewName);
  form.append("image", image);
  return request<InspectionDetail>(
    `/inspections/${inspectionId}/capture`,
    { method: "POST", body: form },
  );
}

