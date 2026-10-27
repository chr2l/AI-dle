// Types of the worker for the tests (tests/polish-etape8.test.ts).
declare const worker: { fetch(request: Request, env: unknown): Promise<Response> };
export default worker;
