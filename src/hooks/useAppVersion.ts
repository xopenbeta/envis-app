import { useEffect } from "react";
import { getCurrentWindow } from '@tauri-apps/api/window';
import pkg from '../../package.json';

export function useAppTitleVersion() {
  useEffect(() => {
    const ver = pkg && pkg.version ? ` v${pkg.version}` : '';
    getCurrentWindow().setTitle(`Envis ${ver}`);
  }, []);
}
