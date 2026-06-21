// Port of ../saloon/src/Enums/Method.php + ../saloon/src/Enums/PipeOrder.php

export enum Method {
  GET = 'GET',
  HEAD = 'HEAD',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  OPTIONS = 'OPTIONS',
  CONNECT = 'CONNECT',
  TRACE = 'TRACE',
}

// Where a middleware pipe is inserted relative to the others (see
// `helpers/middlewarePipeline`): `First` prepends, `Last`/default appends.
export enum PipeOrder {
  First = 'first',
  Last = 'last',
}
