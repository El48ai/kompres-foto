// app.js — PhotoCompress Client-Side Engine

const fileInput = document.getElementById('fileInput');
const cameraInput = document.getElementById('cameraInput');
const cameraBtn = document.getElementById('cameraBtn');
const compressBtn = document.getElementById('compressBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const clearBtn = document.getElementById('clearBtn');
const privacyBtn = document.getElementById('privacyBtn');
const dropzone = document.getElementById('dropzone');

const qualityInput = document.getElementById('quality');
const qualityVal = document.getElementById('qualityVal');
const maxWidthInput = document.getElementById('maxWidth');
const formatSelect = document.getElementById('formatSelect');

const gallery = document.getElementById('gallery');
const statusEl = document.getElementById('status');
const progressBar = document.getElementById('progressBar');

const privacyModal = document.getElementById('privacyModal');
const closePrivacy = document.getElementById('closePrivacy');

const camModal = document.getElementById('camModal');
const camVideo = document.getElementById('camVideo');
const camCapture = document.getElementById('camCapture');
const camCancel = document.getElementById('camCancel');

const toast = document.getElementById('toast');

let items = [];
let camStream = null;

// UI Helpers
function setStatus(text){ statusEl.textContent = text; }
function showToast(text){
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}
function formatBytes(bytes){
  if(bytes === 0) return '0 B';
  const units = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return value.toFixed(value >= 10 || i === 0 ? 0 : 1) + ' ' + units[i];
}
function resetProgress(){ progressBar.style.width = '0%'; }
function setProgress(percent){ progressBar.style.width = Math.max(0, Math.min(100, percent)) + '%'; }

// Event Listeners Input
qualityInput.addEventListener('input', () => { qualityVal.textContent = qualityInput.value; });

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', e => {
  if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); fileInput.click(); }
});
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', e => {
  e.preventDefault(); dropzone.classList.remove('drag');
  if(e.dataTransfer.files) handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', e => {
  if(e.target.files){ handleFiles(e.target.files); fileInput.value = ''; }
});

// Penanganan File Masuk
function handleFiles(fileList){
  const incoming = Array.from(fileList).filter(file => file.type.startsWith('image/'));
  if(incoming.length === 0){ showToast('File bukan gambar.'); return; }

  const remaining = 20 - items.length;
  if(remaining <= 0){ showToast('Maksimal 20 file.'); return; }

  const allowed = incoming.slice(0, remaining);
  allowed.forEach(file => {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
    items.push({
      id, file,
      originalUrl: URL.createObjectURL(file),
      compressedBlob: null, compressedUrl: null, compressedName: null, error: null
    });
  });

  if(incoming.length > allowed.length) showToast('Sebagian file tidak ditambahkan. Maksimal 20 file.');

  downloadZipBtn.disabled = true;
  resetProgress();
  renderGallery();
  setStatus(items.length + ' file siap');
}

// Render Tampilan Galeri & Pratinjau
function renderGallery(){
  gallery.innerHTML = '';
  if(items.length === 0){
    gallery.innerHTML = '<div class="empty">Belum ada gambar. Pilih file dulu.</div>';
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div'); card.className = 'thumb';
    const img = document.createElement('img');
    img.src = item.compressedUrl || item.originalUrl;
    img.alt = item.file.name;

    const meta = document.createElement('div'); meta.className = 'meta';
    const originalSize = formatBytes(item.file.size);
    let detail = `<strong>${item.file.name}</strong><span>Asli: ${originalSize}</span>`;

    if(item.error){
      detail += `<span class="fail">${item.error}</span>`;
    } else if(item.compressedBlob){
      const newSize = formatBytes(item.compressedBlob.size);
      const saving = Math.max(0, 100 - Math.round((item.compressedBlob.size / item.file.size) * 100));
      detail += `<span>Hasil: ${newSize}</span><span class="saving">Hemat: ${saving}%</span>`;
    } else {
      detail += `<span>Belum dikompres</span>`;
    }
    meta.innerHTML = detail;

    const actions = document.createElement('div'); actions.className = 'thumb-actions';
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn'; downloadBtn.textContent = item.compressedBlob ? 'Unduh' : 'Asli';
    downloadBtn.addEventListener('click', () => {
      if(item.compressedBlob) downloadBlob(item.compressedBlob, item.compressedName);
      else downloadUrl(item.originalUrl, item.file.name);
    });

    actions.appendChild(downloadBtn);
    card.appendChild(img); card.appendChild(meta); card.appendChild(actions);
    gallery.appendChild(card);
  });
}

// Tombol Bersihkan
clearBtn.addEventListener('click', () => {
  items.forEach(item => {
    if(item.originalUrl) URL.revokeObjectURL(item.originalUrl);
    if(item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
  });
  items = [];
  gallery.innerHTML = '<div class="empty">Belum ada gambar. Pilih file dulu.</div>';
  resetProgress(); downloadZipBtn.disabled = true;
  setStatus('Bersih'); showToast('Daftar gambar dibersihkan.');
});

// Tombol Kompres
compressBtn.addEventListener('click', async () => {
  if(items.length === 0){ alert('Belum ada file untuk dikompres.'); return; }

  compressBtn.disabled = true; downloadZipBtn.disabled = true;
  resetProgress(); setStatus('Mengompres...');

  const total = items.length;
  let successCount = 0;

  for(let i = 0; i < total; i++){
    const item = items[i];
    try {
      setStatus('Mengompres ' + (i + 1) + '/' + total + '...');
      const result = await compressImage(item.file, {
        quality: Number(qualityInput.value) / 100,
        maxWidth: Number(maxWidthInput.value),
        format: formatSelect.value
      });

      if(item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
      item.compressedBlob = result.blob;
      item.compressedName = item.file.name.replace(/\.[^/.]+$/, '') + result.ext;
      item.compressedUrl = URL.createObjectURL(result.blob);
      item.error = null;
      successCount++;
    } catch(error) {
      item.error = 'Gagal dikompres'; console.error(error);
    }
    setProgress(Math.round(((i + 1) / total) * 100));
    renderGallery();
  }

  compressBtn.disabled = false; downloadZipBtn.disabled = successCount === 0;

  if(successCount > 0){
    setStatus('Selesai — ' + successCount + ' file berhasil'); showToast('Kompresi selesai.');
  } else {
    setStatus('Gagal mengompres file'); showToast('Gagal mengompres gambar.');
  }
});

// Tombol Download ZIP (Menggunakan window.JSZip bawaan browser HTML)
downloadZipBtn.addEventListener('click', async () => {
  const validItems = items.filter(i => i.compressedBlob);
  if(validItems.length === 0){ alert('Belum ada hasil kompres.'); return; }
  if(typeof window.JSZip === 'undefined'){ alert('JSZip gagal dimuat. Cek koneksi internet lalu refresh.'); return; }

  const zip = new window.JSZip();
  validItems.forEach(item => { zip.file(item.compressedName, item.compressedBlob); });

  setStatus('Membuat ZIP...'); downloadZipBtn.disabled = true;
  const content = await zip.generateAsync({type:'blob'}, meta => { setProgress(Math.floor(meta.percent)); });
  
  downloadBlob(content, 'hasil_kompres.zip');
  downloadZipBtn.disabled = false; setStatus('ZIP siap diunduh'); showToast('ZIP dibuat.');
});

// Logika Pemrosesan Gambar (Canvas API)
async function compressImage(file, {quality, maxWidth, format}){
  const img = await loadImage(file);
  const target = resizePreserve(img.width, img.height, maxWidth);

  const canvas = document.createElement('canvas');
  canvas.width = target.width; canvas.height = target.height;
  
  const ctx = canvas.getContext('2d', {alpha:false}); // Nonaktifkan alpha untuk menghemat memori jika bisa
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

  const output = getOutputFormat(format);

  // FIX: Cegah background PNG transparan menjadi Hitam kelam jika disimpan sebagai JPG
  if(output.mime === 'image/jpeg'){
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, target.width, target.height);
  }

  ctx.drawImage(img, 0, 0, target.width, target.height);
  
  // PNG tidak support argumen quality di canvasToBlob
  const appliedQuality = (output.mime === 'image/png') ? undefined : quality;
  const blob = await canvasToBlob(canvas, output.mime, appliedQuality);

  return { blob, ext: output.ext, mime: output.mime };
}

function loadImage(file){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar rusak.')); };
    img.src = url;
  });
}

function resizePreserve(width, height, maxWidth){
  const maxW = Number(maxWidth) || 2048;
  if(width <= maxW) return {width, height};
  const ratio = maxW / width;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function canvasToBlob(canvas, mime, quality){
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if(blob) resolve(blob); else reject(new Error('Gagal proses blob.'));
    }, mime, quality);
  });
}

function getOutputFormat(format){
  if(format === 'webp') return supportsWebP() ? {mime:'image/webp', ext:'.webp'} : {mime:'image/jpeg', ext:'.jpg'};
  if(format === 'jpeg') return {mime:'image/jpeg', ext:'.jpg'};
  if(format === 'png')  return {mime:'image/png', ext:'.png'};
  // Auto
  return supportsWebP() ? {mime:'image/webp', ext:'.webp'} : {mime:'image/jpeg', ext:'.jpg'}; 
}

function supportsWebP(){
  try{
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch(e){ return false; }
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob); downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadUrl(url, filename){
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}

// Modal Privasi
privacyBtn.addEventListener('click', () => privacyModal.style.display = 'flex');
closePrivacy.addEventListener('click', () => privacyModal.style.display = 'none');
privacyModal.addEventListener('click', e => { if(e.target === privacyModal) privacyModal.style.display = 'none'; });

// Kamera Mobile (Fallback ke webRTC jika di desktop/browser didukung)
cameraBtn.addEventListener('click', () => {
  // Langsung panggil aplikasi kamera bawaan HP untuk hasil yang lebih baik daripada WebRTC HTML
  cameraInput.click();
});

// Tapi jika kamu mau memunculkan modal kamera custom di desktop, gunakan kode di bawah.
// (Saat ini ditautkan ke input bawaan HP agar hasil foto tidak buram).
cameraInput.addEventListener('change', e => {
  if(e.target.files && e.target.files.length){ handleFiles(e.target.files); cameraInput.value = ''; }
});

setStatus('Siap');
