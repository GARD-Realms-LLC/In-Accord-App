declare module "asar" {
    export function extractAll(asarPath: string, dest: string): void;
    export function createPackage(srcDir: string, outAsar: string, callback: (err?: any) => void): void;
    export function extractFile?(asarPath: string, filename: string): any;
}
