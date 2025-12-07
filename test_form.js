const FormData = require('form-data');
const form = new FormData();
form.append('manifest', JSON.stringify({foo: 'bar'}), { contentType: 'application/json' });
form.append('file', Buffer.from('test'), { contentType: 'application/zip', filename: 'site.zip' });

try {
    const buffer = form.getBuffer();
    console.log('Buffer created, size:', buffer.length);
    console.log('Headers:', form.getHeaders());
    console.log('Body Preview:', buffer.toString().substring(0, 200));
} catch (e) {
    console.error('Error:', e);
}
