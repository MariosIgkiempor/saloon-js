// Port of ../saloon/src/Data/MultipartValue.php
//
// One field in a multipart body. `value` is a string or Blob (the web equivalents
// of PHP's string/resource/StreamInterface); `filename` marks it as a file part.

export interface MultipartValue {
  name: string;
  value: string | Blob;
  filename?: string;
  headers?: Record<string, string>;
}
