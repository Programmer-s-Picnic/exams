(function () {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.AdminConsole = { async render(state, token) {
    const mount = document.getElementById('app');
    mount.innerHTML = '<section class="page"><p>Checking admin access…</p></section>';
    let info;
    try { info = await Api.auth('admin', undefined, token); }
    catch (error) {
      if (location.hash !== '#/admin') return;
      mount.innerHTML = `<section class="page narrow"><span class="eyebrow">ADMINISTRATION</span><h1>Admin access</h1><p>${esc(error.message)}</p><p>Sign in using an account approved by the site owner.</p><div class="admin-tools"><a class="primary-button" href="#/login">Sign in</a><a class="ghost-button" href="#/inventory">Public content inventory</a></div></section>`; return;
    }
    if (location.hash !== '#/admin') return;
    mount.innerHTML = `<section class="page admin-page"><div class="page-hero"><span class="eyebrow">HIMANSHU EXAMS · ADMINISTRATION</span><h1>Manage your exam portal</h1><p>Update published content and review registered students.</p></div><div class="admin-console"><aside class="admin-menu"><button data-panel="overview" class="active">Overview</button><button data-panel="validation">Validation</button><button data-panel="content">Exam content</button><button data-panel="students">Students</button><button data-panel="guide">How to use</button><a class="ghost-button" href="#/inventory">Files & diagrams</a><a class="ghost-button" href="#/landing">View website →</a></aside><article class="admin-workspace" id="adminWorkspace"></article></div></section>`;
    const workspace = document.getElementById('adminWorkspace');
    let dirty = false;
    async function panel(name) {
      if (dirty && !confirm('Discard your unsaved content changes?')) return;
      dirty = false;
      document.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
      if (name === 'overview') workspace.innerHTML = `<h2>Portal overview</h2><div class="admin-metrics"><article><b>${state.exams.length}</b>Exams</article><article><b>${state.tests.length}</b>Test papers</article><article><b>${info.studentCount}</b>Registered students</article></div><h3>Content workflow</h3><p>Choose a content file, edit its JSON, validate it, then save. Updates go directly to the server. Reload the website after saving to see the latest content.</p><p>Student test attempts and reports currently stay on their device. This dashboard does not collect them.</p>`;
      if (name === 'validation') {
        workspace.innerHTML = '<p>Loading validation queue…</p>';
        try {
          const data = await Api.auth('admin', {action:'validation-list'}, token);
          if (!workspace.isConnected) return;
          const rows = [
            ...data.syllabi.map(item => ({...item, target:'syllabus', kind:'Syllabus'})),
            ...data.papers.map(item => ({...item, target:'paper', kind:'Paper'}))
          ];
          const renderQueue = () => {
            const pending = rows.filter(item => item.status === 'pending').length;
            const approved = rows.filter(item => item.status === 'approved').length;
            workspace.innerHTML = `<h2>Content validation</h2><p>Imported syllabus and previous-paper data is hidden from students until an approved exam-site admin validates it here.</p><div class="admin-metrics"><article><b>${pending}</b>Pending</article><article><b>${approved}</b>Approved</article><article><b>${rows.length}</b>Total records</article></div><div style="overflow:auto"><table class="admin-table"><thead><tr><th>Type</th><th>Record</th><th>Status</th><th>Validated by</th><th>Action</th></tr></thead><tbody>${rows.map(item => `<tr><td>${esc(item.kind)}</td><td><strong>${esc(item.title)}</strong><br><small>${esc(item.examId || '')}${item.examDate ? ' · '+esc(item.examDate) : ''}${item.shift ? ' · Shift '+esc(item.shift) : ''}</small></td><td>${esc(item.status)}</td><td>${esc(item.validatedBy || '—')}</td><td><button class="ghost-button" data-validate-target="${esc(item.target)}" data-validate-id="${esc(item.id)}" data-decision="approved">Approve</button> <button class="ghost-button" data-validate-target="${esc(item.target)}" data-validate-id="${esc(item.id)}" data-decision="rejected">Reject</button></td></tr>`).join('') || '<tr><td colspan="5">Nothing to validate.</td></tr>'}</tbody></table></div>`;
            workspace.querySelectorAll('[data-validate-target]').forEach(button => button.onclick = async () => {
              const decision = button.dataset.decision;
              const target = button.dataset.validateTarget;
              const id = button.dataset.validateId;
              if (!confirm(`${decision === 'approved' ? 'Approve' : 'Reject'} this ${target} record for student publication?`)) return;
              button.disabled = true;
              try {
                const result = await Api.auth('admin', {action:'validate-record', target, id, decision}, token);
                const row = rows.find(item => item.target === target && String(item.id) === String(id));
                if (row) { row.status = result.status; row.validatedBy = result.validatedBy; }
                renderQueue();
              } catch (error) {
                alert(error.message);
                button.disabled = false;
              }
            });
          };
          renderQueue();
        } catch (e) { workspace.textContent = e.message; }
      }
      if (name === 'guide') workspace.innerHTML = `<h2>How to use the admin section</h2><ol class="admin-guide"><li>Sign in with your approved admin account.</li><li>Open <b>Validation</b> first. Imported syllabus and previous-paper records stay hidden from students until an approved admin explicitly approves them.</li><li>Open <b>Exam content</b> to edit site settings, exams, test papers, syllabus or previous-paper data.</li><li>Click <b>Load file</b>. Download a copy before making major changes.</li><li>Edit the JSON. Preserve IDs referenced by other files. Keep unavailable exams marked as coming soon.</li><li>Click <b>Validate JSON</b>, then <b>Save to server</b>. The server validates the structure and backs up the previous version.</li><li>Open the website and check the changed exam or test. Diagnostic timing and scoring should remain fixed.</li><li>Use <b>Students</b> to review registrations. Passwords and session tokens are never shown.</li></ol><p>Only approved accounts can load or save content through the admin API. The public inventory provides documentation and diagrams.</p>`;
      if (name === 'students') {
        workspace.innerHTML = '<p>Loading students…</p>';
        try { const result = await Api.auth('admin', {action:'students'}, token); if (!workspace.isConnected) return; workspace.innerHTML = `<h2>Registered students</h2><p>Latest 200 registrations.</p><div style="overflow:auto"><table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Mobile</th></tr></thead><tbody>${result.students.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.mobile)}</td></tr>`).join('') || '<tr><td colspan="3">No registrations yet.</td></tr>'}</tbody></table></div>`; } catch (e) {workspace.textContent = e.message;}
      }
      if (name === 'content') {
        workspace.innerHTML = `<h2>Published content</h2><label for="adminFile">Content file</label><div class="admin-tools"><select id="adminFile">${info.files.map(f=>`<option>${esc(f)}</option>`).join('')}</select><button class="ghost-button" id="loadContent">Load file</button></div><textarea class="admin-editor" id="contentEditor" aria-label="JSON content" spellcheck="false" disabled></textarea><div class="admin-tools"><button id="validateContent" class="ghost-button" disabled>Validate JSON</button><button id="downloadContent" class="ghost-button" disabled>Download copy</button><button id="saveContent" class="primary-button" disabled>Save to server</button></div><p class="admin-status" id="adminStatus" role="status">Select a file and load it to begin.</p>`;
        const editor = document.getElementById('contentEditor'), select = document.getElementById('adminFile'), status = document.getElementById('adminStatus'); let revision, loaded;
        const controls = ['validateContent','downloadContent','saveContent'].map(id=>document.getElementById(id));
        document.getElementById('loadContent').onclick = async () => {
          if (dirty && !confirm('Discard your unsaved changes?')) return;
          controls.forEach(b=>b.disabled=true); editor.disabled=true; status.textContent='Loading…';
          try { const result = await Api.auth('admin',{action:'load',file:select.value},token); loaded=select.value; revision=result.revision; editor.value=JSON.stringify(result.content,null,2); dirty=false; editor.disabled=false; controls.forEach(b=>b.disabled=false); status.textContent=`Loaded ${loaded}.`; } catch(e) {status.textContent=e.message;}
        };
        editor.oninput=()=>{dirty=true;status.textContent='Unsaved changes.';};
        controls[0].onclick=()=>{try{JSON.parse(editor.value);status.textContent='Valid JSON syntax. The server also checks the file structure on save.';}catch(e){status.textContent=e.message;}};
        controls[1].onclick=()=>{const url=URL.createObjectURL(new Blob([editor.value],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download=loaded;a.click();URL.revokeObjectURL(url);};
        controls[2].onclick=async()=>{
          let content;try{content=JSON.parse(editor.value);}catch(e){status.textContent=e.message;return;}
          if(!confirm(`Publish changes to ${loaded}?`))return;
          controls.forEach(b=>b.disabled=true);status.textContent='Saving…';
          try{const result=await Api.auth('admin',{action:'save',file:loaded,content,revision},token);revision=result.revision;dirty=false;status.textContent='Saved to server. Previous version backed up. Reload the website to check the update.';}catch(e){status.textContent=e.message;}finally{controls.forEach(b=>b.disabled=false);}
        };
      }
    }
    document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>panel(b.dataset.panel)); panel('overview');
  }};
}());
