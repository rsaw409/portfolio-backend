import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';

class SupaBase {
  #supabase: SupabaseClient;

  constructor() {
    this.#supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );
  }

  async uploadFileToSupabse(url: string, file: Express.Multer.File) {
    const fileBase64 = decode(file.buffer.toString('base64'));

    await this.#supabase.storage
      .from('portfolio_images')
      .upload(url, fileBase64, {
        contentType: file.mimetype,
      });
  }

  async deleteFileFromSupabase(prefix: string) {
    const { data: list } = await this.#supabase.storage
      .from('portfolio_images')
      .list(prefix);
    if (list?.length) {
      const filesToRemove = list.map((x) => `${prefix}/${x.name}`);
      await this.#supabase.storage
        .from('portfolio_images')
        .remove(filesToRemove);
    }
  }
}

export default new SupaBase();
