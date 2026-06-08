import { authenticate } from '../../utils/auth.js';

export async function POST(request) {
  try {
    await authenticate(request);
  } catch (err) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'IMGBB_API_KEY not configured' }, { status: 500 });
    }

    const uploadForm = new FormData();
    uploadForm.append('image', file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: uploadForm,
    });

    const data = await response.json();

    if (!data.success) {
      return Response.json({ error: 'Upload failed', details: data }, { status: 500 });
    }

    return Response.json({ url: data.data.url });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
