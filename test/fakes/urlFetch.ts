/** In-memory UrlFetchApp. Records every request and answers with a test-supplied responder. */
export interface FakeRequest {
  readonly url: string;
  readonly params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;
}

export interface FakeReply {
  readonly status: number;
  readonly body: string;
  readonly headers?: Record<string, string>;
}

export type Responder = (request: FakeRequest) => FakeReply;

export interface FakeUrlFetchApp {
  readonly requests: FakeRequest[];
  respondWith(responder: Responder): void;
  fetch(
    url: string,
    params?: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions,
  ): {
    getResponseCode(): number;
    getContentText(): string;
    getHeaders(): Record<string, string>;
  };
}

export function createUrlFetchApp(): FakeUrlFetchApp {
  const requests: FakeRequest[] = [];
  let responder: Responder = () => ({ status: 404, body: "" });
  return {
    requests,
    respondWith(next) {
      responder = next;
    },
    fetch(url, params = {}) {
      const request = { url, params };
      requests.push(request);
      const reply = responder(request);
      return {
        getResponseCode: () => reply.status,
        getContentText: () => reply.body,
        getHeaders: () => reply.headers ?? {},
      };
    },
  };
}
