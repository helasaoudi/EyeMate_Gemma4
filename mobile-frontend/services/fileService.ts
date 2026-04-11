import { documentDirectory, getInfoAsync, makeDirectoryAsync, writeAsStringAsync, readDirectoryAsync, deleteAsync, EncodingType } from 'expo-file-system';

class FileService {
  private imageDir: string;

  constructor() {
    this.imageDir = `${documentDirectory}images/`;
    console.log('📁 Dossier images:', this.imageDir);
    this.ensureDirExists();
  }

  private async ensureDirExists() {
    try {
      const dirInfo = await getInfoAsync(this.imageDir);
      console.log('📁 Info dossier:', dirInfo);
      if (!dirInfo.exists) {
        await makeDirectoryAsync(this.imageDir, { intermediates: true });
        console.log('✅ Dossier créé:', this.imageDir);
      }
    } catch (error) {
      console.error('Error creating directory:', error);
    }
  }

  async saveImage(base64Image: string, filename: string): Promise<string> {
    try {
      await this.ensureDirExists();
      
      const fileUri = `${this.imageDir}${filename}`;
      console.log('💾 Sauvegarde image:', fileUri);
      
      await writeAsStringAsync(fileUri, base64Image, {
        encoding: EncodingType.Base64,
      });
      
      console.log('✅ Image sauvegardée:', fileUri);
      return fileUri;
    } catch (error) {
      console.error('Error saving image:', error);
      throw error;
    }
  }

 

  async debugStorage() {
    try {
      console.log('=== 🗂️ DEBUG STORAGE ===');
      console.log('📁 Document Directory:', documentDirectory);
      console.log('📁 Dossier images:', this.imageDir);
      
      const dirInfo = await getInfoAsync(this.imageDir);
      console.log('📁 Dossier existe:', dirInfo.exists);
      
      if (dirInfo.exists) {
        const files = await readDirectoryAsync(this.imageDir);
        console.log('📁 Nombre de fichiers:', files.length);
        files.forEach((file, index) => {
          console.log(`   ${index + 1}. ${file}`);
          console.log(`      Chemin complet: ${this.imageDir}${file}`);
        });
      }
      console.log('=== FIN DEBUG ===');
    } catch (error) {
      console.error('Erreur debug:', error);
    }
  }

  async getImageUris(): Promise<string[]> {
    try {
      await this.ensureDirExists();
      const files = await readDirectoryAsync(this.imageDir);
      return files.map(file => `${this.imageDir}${file}`);
    } catch (error) {
      console.error('Error reading images:', error);
      return [];
    }
  }

  async deleteImage(uri: string): Promise<void> {
    try {
      await deleteAsync(uri);
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  }

  async clearAllImages(): Promise<void> {
    try {
      await deleteAsync(this.imageDir);
      await this.ensureDirExists();
    } catch (error) {
      console.error('Error clearing images:', error);
    }
  }

  generateFilename(prefix: string = 'image'): string {
    const timestamp = new Date().getTime();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}.jpg`;
  }
}

export default new FileService();