declare namespace findup {
  function sync(start: string, file: string) : string;
}

declare module "findup" {
  export = findup;
}
