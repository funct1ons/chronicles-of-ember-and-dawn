export function matchPrecached(cache:Pick<Cache,'match'>,request:Request,urls:ReadonlySet<string>):Promise<Response|undefined>;
export function rangeResponse(response:Response,range:string|null):Promise<Response>;
