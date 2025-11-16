
const KEY = 'noteflow_v3';
let notes = [];
let selectedId = null;

// refs
const els = {
  notesList: document.getElementById('notesList'),
  addNew: document.getElementById('addNewBtn'),
  newBtnSidebar: document.getElementById('newBtn'),
  fileInput: document.getElementById('openFile'),
  saveBtn: document.getElementById('saveBtn'),
  deleteBtn: document.getElementById('deleteBtn'),
  noteTitle: document.getElementById('noteTitle'),
  noteBody: document.getElementById('noteBody'),
  autosave: document.getElementById('autosave'),
  charCount: document.getElementById('charCount'),
  lastEdited: document.getElementById('lastEdited'),
  tagInput: document.getElementById('tagInput'),
  tagChips: document.getElementById('tagChips'),
  previewEl: document.getElementById('preview'),
  previewToggle: document.getElementById('previewToggle'),
  pinBtn: document.getElementById('pinBtn'),
  exportBtn: document.getElementById('exportBtn'),
  noteTpl: document.getElementById('noteItemTpl'),
  drawCanvas: document.getElementById('drawCanvas'),
  drawClear: document.getElementById('drawClear'),
  drawSave: document.getElementById('drawSave'),
  drawPreview: document.getElementById('drawPreview'),
  nfWrap: document.querySelector('.nf-underline-wrap'),
  nfTitle: document.querySelector('.nf-title'),
  search: document.getElementById('search')
};


function loadNotes(){ try { notes = JSON.parse(localStorage.getItem(KEY)) || []; } catch(e){ notes = []; } }
function saveAll(){ localStorage.setItem(KEY, JSON.stringify(notes)); }


function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function escapeHTML(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }


function renderList(){
  const container = els.notesList;
  const q = (els.search?.value || '').trim().toLowerCase();
  container.innerHTML = '';
  notes.forEach(n=>{
    if(q){
      const hay = (n.title + ' ' + n.body + ' ' + (n.tags||[]).join(' ')).toLowerCase();
      if(!hay.includes(q)) return;
    }
    const tpl = document.importNode(els.noteTpl.content, true);
    const row = tpl.querySelector('.note-row');
    const titleEl = tpl.querySelector('.note-title');
    const snippetEl = tpl.querySelector('.note-snippet');
    const tagsEl = tpl.querySelector('.note-tags');
    const thumbWrap = row.querySelector('.thumb-wrap');
    const trashBtn = tpl.querySelector('.trash');

    row.dataset.id = n.id;
    titleEl.textContent = n.title || 'Untitled';
    snippetEl.textContent = (n.body || '').split('\n')[0].slice(0,120);
    tagsEl.textContent = (n.tags||[]).join(', ');


    thumbWrap.innerHTML = '';
    if(n.drawData){
      const img = document.createElement('img');
      img.src = n.drawData;
      img.alt = 'drawing';
      thumbWrap.appendChild(img);
    } else {
      thumbWrap.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:6px;text-align:center">No image</div>';
    }


    row.addEventListener('click', (e)=> {
      if(e.target.closest('.trash')) return;
      selectNote(n.id);
    });
    trashBtn.addEventListener('click', (ev)=> {
      ev.stopPropagation();
      if(!confirm('Delete this note?')) return;
      notes = notes.filter(x=>x.id !== n.id);
      if(selectedId === n.id) selectedId = notes[0]?.id || null;
      saveAll(); renderList(); renderSelected();
    });

   
    row.draggable = true;
    row.addEventListener('dragstart', (e)=> { row.classList.add('dragging'); e.dataTransfer.setData('text/plain', n.id); });
    row.addEventListener('dragend', ()=> row.classList.remove('dragging'));
    row.addEventListener('dragover', (e)=> e.preventDefault());
    row.addEventListener('drop', (e)=> { e.preventDefault(); const srcId = e.dataTransfer.getData('text/plain'); reorderNotes(srcId, n.id); });

    container.appendChild(row);
  });

  if(!container.children.length) container.innerHTML = '<div style="color:var(--muted);padding:12px">No notes yet — create one!</div>';
}

function renderSelected(){
  if(!selectedId){
    els.noteTitle.value = '';
    els.noteBody.value = '';
    els.tagChips.innerHTML = '';
    els.lastEdited.textContent = 'No note selected';
    els.charCount.textContent = '0 chars';
    els.autosave.textContent = 'Saved';
    els.drawPreview.innerHTML = '<div class="small-muted">No drawing</div>';
    els.previewEl && (els.previewEl.innerHTML = '<div class="small-muted">Nothing to preview</div>');
    clearCanvas();
    return;
  }
  const n = notes.find(x=>x.id===selectedId);
  if(!n) return;
  els.noteTitle.value = n.title;
  els.noteBody.value = n.body || '';
  els.lastEdited.textContent = 'Last edited: ' + new Date(n.updated).toLocaleString();
  els.charCount.textContent = (n.body||'').length + ' chars';
  renderTags(n.tags || []);
  renderPreview(n.body || '');
  if(n.drawData){
   
    els.drawPreview.innerHTML = '';
    const img = document.createElement('img');
    img.src = n.drawData;
    img.style.maxWidth = '100%';
    img.style.borderRadius = '6px';
    img.alt = 'drawing';
    els.drawPreview.appendChild(img);
    
    showDrawing(n.drawData);
  } else {
    els.drawPreview.innerHTML = '<div class="small-muted">No drawing</div>';
    clearCanvas();
  }
}


function renderTags(tags){
  els.tagChips.innerHTML = '';
  (tags||[]).forEach(t=>{
    const c = document.createElement('div');
    c.className = 'chip';
    c.innerHTML = `<span>${escapeHTML(t)}</span><span class="x">✕</span>`;
    c.querySelector('.x').addEventListener('click', ()=> removeTag(t));
    els.tagChips.appendChild(c);
  });
}
function addTag(tag){
  if(!selectedId || !tag) return;
  const n = notes.find(x=>x.id===selectedId);
  n.tags = Array.from(new Set([...(n.tags||[]), tag.trim()]));
  saveAll(); renderTags(n.tags); renderList();
}
function removeTag(tag){
  if(!selectedId) return;
  const n = notes.find(x=>x.id===selectedId);
  n.tags = (n.tags||[]).filter(t=>t!==tag);
  saveAll(); renderTags(n.tags); renderList();
}


function renderPreview(md){
  if(!els.previewEl) return;
  if(!md) { els.previewEl.innerHTML = '<div class="small-muted">Nothing to preview</div>'; return; }
  let html = escapeHTML(md);
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = '<p>' + html.replace(/\n/g, '<br/>') + '</p>';
  els.previewEl.innerHTML = html;
}


function createNote(){
  const n = { id: uid(), title:'', body:'', tags:[], pinned:false, updated: Date.now(), drawData: null };
  notes.unshift(n);
  selectedId = n.id;
  saveAll(); renderList(); renderSelected();
}
function selectNote(id){ selectedId = id; renderList(); renderSelected(); }
function saveNote(){
  if(!selectedId) return alert('Select or create a note first');
  const n = notes.find(x=>x.id===selectedId);
  n.title = els.noteTitle.value;
  n.body = els.noteBody.value;
  n.updated = Date.now();
  saveAll(); renderList(); renderSelected(); showSaved();
}
function deleteNote(){
  if(!selectedId) return alert('Select a note first');
  if(!confirm('Delete this note?')) return;
  notes = notes.filter(x=>x.id !== selectedId);
  selectedId = notes[0]?.id || null;
  saveAll(); renderList(); renderSelected();
}
function showSaved(){
  els.autosave.textContent = 'Saved';
  setTimeout(()=> els.autosave.textContent = 'Saved', 900);
}
function togglePin(id){
  const n = notes.find(x=>x.id===id);
  if(!n) return;
  n.pinned = !n.pinned;
  notes.sort((a,b)=>{
    if(a.pinned && !b.pinned) return -1;
    if(!a.pinned && b.pinned) return 1;
    return (b.updated || 0) - (a.updated || 0);
  });
  saveAll(); renderList();
}
function reorderNotes(srcId, destId){
  const srcIdx = notes.findIndex(n=>n.id===srcId);
  const destIdx = notes.findIndex(n=>n.id===destId);
  if(srcIdx < 0 || destIdx < 0) return;
  const [item] = notes.splice(srcIdx,1);
  notes.splice(destIdx, 0, item);
  saveAll(); renderList();
}


function importFromFile(file){
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const data = JSON.parse(e.target.result);
      if(!Array.isArray(data)) { alert('File must contain an array of notes (JSON).'); return; }
      const imported = data.map(n => ({
        id: uid(),
        title: n.title || '',
        body: n.body || '',
        tags: n.tags || [],
        pinned: n.pinned || false,
        updated: n.updated || Date.now(),
        drawData: n.drawData || null
      }));
      notes = [...imported, ...notes];
      saveAll(); renderList(); alert('Imported ' + imported.length + ' notes.');
    } catch(err){
      console.error(err); alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
}
function exportNotes(){
  const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'noteflow-notes.json'; a.click(); URL.revokeObjectURL(url);
}


let drawing = false, lastX = 0, lastY = 0;
const canvas = els.drawCanvas;
const ctx = canvas ? canvas.getContext('2d') : null;

function fitCanvas(){
  if(!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  if(ctx){ ctx.setTransform(dpr,0,0,dpr,0,0); ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth=3; ctx.strokeStyle='#111'; }
}
function setupCanvas(){
  if(!canvas) return;
 
  if(!canvas.style.height) canvas.style.height = '320px';
  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  canvas.addEventListener('pointerdown', (e)=>{
    drawing = true;
    const r = canvas.getBoundingClientRect();
    lastX = e.clientX - r.left;
    lastY = e.clientY - r.top;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e)=>{
    if(!drawing) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if(ctx){
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    lastX = x; lastY = y;
  });
  canvas.addEventListener('pointerup', (e)=>{ drawing = false; try{ e.target.releasePointerCapture(e.pointerId);}catch(_){} });
  canvas.addEventListener('pointercancel', ()=> drawing = false);
}
function clearCanvas(){
  if(!canvas || !ctx) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
}
function showDrawing(dataUrl){
  if(!canvas || !ctx) return;
  const img = new Image();
  img.onload = ()=>{
    clearCanvas();
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, rect.width * dpr, rect.height * dpr);
  };
  img.src = dataUrl;
}
function saveDrawingToNote(){
  if(!canvas || !selectedId) return alert('Select a note first');
  const data = canvas.toDataURL('image/png');
  const n = notes.find(x=>x.id===selectedId);
  n.drawData = data;
  n.updated = Date.now();
  saveAll(); renderList(); renderSelected();
  alert('Drawing saved to note.');
}


let autosaveTimeout;
els.noteBody.addEventListener('input', ()=>{
  els.charCount.textContent = els.noteBody.value.length + ' chars';
  renderPreview(els.noteBody.value);
  clearTimeout(autosaveTimeout);
  autosaveTimeout = setTimeout(()=> { saveNote(); }, 700);
});
els.noteTitle.addEventListener('input', ()=> {
  clearTimeout(autosaveTimeout);
  autosaveTimeout = setTimeout(()=> { saveNote(); }, 900);
});
els.tagInput && els.tagInput.addEventListener('keyup', (e)=>{
  if(e.key === 'Enter'){ const v = els.tagInput.value.trim(); if(v){ addTag(v); els.tagInput.value = ''; } }
});


document.getElementById('drawClear')?.addEventListener('click', ()=>{
  if(!confirm('Clear drawing?')) return;
  clearCanvas();
});
document.getElementById('drawSave')?.addEventListener('click', saveDrawingToNote);


els.exportBtn?.addEventListener('click', exportNotes);
els.pinBtn?.addEventListener('click', ()=>{ if(!selectedId) return; togglePin(selectedId); });


window.addEventListener('keydown', (e)=>{
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){ e.preventDefault(); saveNote(); }
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='n'){ e.preventDefault(); createNote(); }
});


els.addNew?.addEventListener('click', createNote);
els.newBtnSidebar?.addEventListener('click', createNote);


els.fileInput?.addEventListener('change', (e)=> { const file = e.target.files[0]; if(file) importFromFile(file); e.target.value=''; });


els.search?.addEventListener('input', renderList);

(function headerPenAnimation(){
  const wrap = els.nfWrap, title = els.nfTitle;
  if(!wrap || !title) return;
  const computeWidth = () => {
    const w = Math.min(Math.max(title.offsetWidth * 0.42, 60), 140);
    wrap.style.setProperty('--underline-w', Math.round(w) + 'px');
  };
  computeWidth(); window.addEventListener('resize', computeWidth);
  const play = ()=>{ wrap.classList.remove('animate'); void wrap.offsetWidth; wrap.classList.add('animate'); };
  window.requestAnimationFrame(()=> setTimeout(play, 120));
  title.addEventListener('click', play);
})();


loadNotes();
if(!notes.length){
  notes.push({ id: uid(), title: 'Welcome to NoteFlow', body: 'This is your NoteFlow workspace. Press + New to create a note.\n\n**Enjoy!**', tags:['welcome','demo'], pinned:false, updated: Date.now(), drawData: null });
  saveAll();
}
selectedId = notes[0].id;
renderList();
renderSelected();
setupCanvas();
