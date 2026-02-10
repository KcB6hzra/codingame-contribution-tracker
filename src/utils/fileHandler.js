import fs from 'fs';
import path from 'path';

/**
 * File Handling Utilities
 */
export default class FileHandler {
  constructor(baseDataDir) {
    this.baseDataDir = baseDataDir;
    this.contributionsDir = path.join(baseDataDir, 'contributions');
    this.commentsDir = path.join(baseDataDir, 'comments');
    this._ensureDir(this.contributionsDir);
    this._ensureDir(this.commentsDir);
  }

  _ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
  }

  isKnownContribution(publicHandle) {
    return fs.existsSync(path.join(this.contributionsDir, publicHandle));
  }

  saveContribution(publicHandle, data) {
    const dir = path.join(this.contributionsDir, publicHandle);
    this._ensureDir(dir);
    const filename = `${this.getTimestamp()}.json`;
    fs.writeFileSync(path.join(dir, filename), JSON.stringify(data, null, 2));
  }

  saveComments(publicHandle, data) {
    const dir = path.join(this.commentsDir, publicHandle);
    this._ensureDir(dir);
    const filename = `${this.getTimestamp()}.json`;
    fs.writeFileSync(path.join(dir, filename), JSON.stringify(data, null, 2));
  }

  getLastSavedContribution(publicHandle) {
    const dir = path.join(this.contributionsDir, publicHandle);
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter(f => f !== 'index.json').sort().reverse();
    if (files.length === 0) return null;
    const content = fs.readFileSync(path.join(dir, files[0]), 'utf-8');
    return JSON.parse(content);
  }

  getLastSavedComments(publicHandle) {
    const dir = path.join(this.commentsDir, publicHandle);
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter(f => f !== 'index.json').sort().reverse();
    if (files.length === 0) return null;
    const content = fs.readFileSync(path.join(dir, files[0]), 'utf-8');
    return JSON.parse(content);
  }

  generateIndices() {
    // Collect all handles and their files for both contributions and comments
    const index = {
      contributions: {},
      comments: {}
    };

    if (fs.existsSync(this.contributionsDir)) {
      const handles = fs.readdirSync(this.contributionsDir).filter(file => {
        return fs.statSync(path.join(this.contributionsDir, file)).isDirectory();
      });
      for (const handle of handles) {
        const dir = path.join(this.contributionsDir, handle);
        const files = fs.readdirSync(dir).filter(f => f !== 'index.json').sort().reverse();
        index.contributions[handle] = files;
      }
    }

    if (fs.existsSync(this.commentsDir)) {
      const handles = fs.readdirSync(this.commentsDir).filter(file => {
        return fs.statSync(path.join(this.commentsDir, file)).isDirectory();
      });
      for (const handle of handles) {
        const dir = path.join(this.commentsDir, handle);
        const files = fs.readdirSync(dir).filter(f => f !== 'index.json').sort().reverse();
        index.comments[handle] = files;
      }
    }

    // Write aggregated index to the root of data directory
    fs.writeFileSync(
      path.join(this.baseDataDir, 'index.json'),
      JSON.stringify(index, null, 2)
    );
  }
}
