import JSZip from 'jszip';
import { MangaPage } from '../types';

export const parseMangaFile = async (file: File): Promise<MangaPage[]> => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  
  const imageFiles: { name: string; zipEntry: JSZip.JSZipObject }[] = [];
  
  // Filter for images
  loadedZip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir && /\.(jpg|jpeg|png|webp|gif)$/i.test(zipEntry.name)) {
      imageFiles.push({ name: zipEntry.name, zipEntry });
    }
  });

  // Natural sort alphanumeric
  imageFiles.sort((a, b) => {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  const pages: MangaPage[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const entry = imageFiles[i];
    const blob = await entry.zipEntry.async('blob');
    const url = URL.createObjectURL(blob);
    pages.push({
      index: i,
      url,
      name: entry.name
    });
  }

  return pages;
};

export const blobUrlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Content = base64String.split(',')[1];
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
