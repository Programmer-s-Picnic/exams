(function () {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderAdminLogin(mount, state, message = '') {
    mount.innerHTML = `<section class="admin-standalone"><div class="admin-login-card"><img src="favicon.svg?v=upnaukriguru" alt="" width="64" height="64"><span class="eyebrow">UP NAUKRIGURU ADMINISTRATION</span><h1>Admin sign in</h1><p>Use an authorised administrator account.</p>${message ? `<p class="form-error">${esc(message)}</p>` : ''}<label>Username<input id="adminLoginId" autocomplete="username" value="admin"></label><label>Password<input id="adminLoginPassword" type="password" autocomplete="current-password" value="admin"></label><button class="primary-button full" id="adminLoginButton">Sign in</button><p class="admin-status" id="adminLoginStatus"></p><p class="admin-developer-credit">Developed and maintained by <strong>Champak Roy</strong></p></div></section>`;
    const button = document.getElementById('adminLoginButton');
    button.onclick = async () => {
      const login = document.getElementById('adminLoginId').value.trim();
      const password = document.getElementById('adminLoginPassword').value;
      const status = document.getElementById('adminLoginStatus');
      if (!login || !password) { status.textContent = 'Enter your login and password.'; return; }
      button.disabled = true; status.textContent = 'Signing in…';
      try {
        const result = await Api.auth('admin', {action:'temporary-login', username:login, password});
        sessionStorage.setItem('he_admin_token', result.token);
        await window.AdminConsole.render(state, result.token);
      } catch (error) {
        status.textContent = error.message;
        button.disabled = false;
      }
    };
  }
  window.AdminConsole = { async render(state, token) {
    const mount = document.getElementById('app');
    mount.innerHTML = '<section class="page"><p>Checking admin access…</p></section>';
    let info;
    try { info = await Api.auth('admin', undefined, token); }
    catch (error) {
      if (location.hash !== '#/admin') return;
      sessionStorage.removeItem('he_admin_token');
      renderAdminLogin(mount, state, '');
      return;
    }
    if (location.hash !== '#/admin') return;
    mount.innerHTML = `<section class="admin-standalone"><header class="admin-shell-header"><div><img src="favicon.svg?v=upnaukriguru" alt="" width="48" height="48"><span><strong>UP NaukriGuru Administration</strong><small>Content, validation and student management</small></span></div><div><a class="ghost-button" href="#/landing">Open student site</a><button class="ghost-button" id="adminSignOut" type="button">Sign out</button></div></header><div class="page admin-page"><div class="page-hero compact"><span class="eyebrow">ADMINISTRATION</span><h1>Administration dashboard</h1><p>Manage exam content, validations and student registrations.</p></div><div class="admin-console"><aside class="admin-menu"><button data-panel="overview" class="active">Overview</button><button data-panel="validation">Validation</button><button data-panel="content">Exam content</button><button data-panel="students">Students</button><button data-panel="guide">How to use</button></aside><article class="admin-workspace" id="adminWorkspace"></article></div></div><footer class="admin-product-footer">Developed and maintained by <strong>Champak Roy</strong></footer></section>`;
    document.getElementById('adminSignOut').onclick = () => {
      sessionStorage.removeItem('he_admin_token');
      location.hash = '#/admin';
      location.reload();
    };
    const workspace = document.getElementById('adminWorkspace');
    let dirty = false;
    async function panel(name) {
      if (dirty && !confirm('Discard your unsaved content changes?')) return;
      dirty = false;
      document.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
      if (name === 'overview') workspace.innerHTML = `<h2>Portal overview</h2><div class="admin-metrics"><article><b>${state.exams.length}</b>Exams</article><article><b>${state.tests.length}</b>Test papers</article><article><b>${info.studentCount}</b>Registered students</article></div><h3>Content workflow</h3><p>Use Validation for syllabus and previous-paper records. Use Exam content for broader JSON updates. Changes are backed up before saving.</p>`;
      if (name === 'validation') {
        workspace.innerHTML = '<p>Loading validation queue…</p>';
        try {
          const data = await Api.auth('admin', {action:'validation-list'}, token);
          if (!workspace.isConnected) return;
          const rows = [
            ...data.syllabi.map(item => ({...item, target:'syllabus', kind:'Syllabus'})),
            ...data.papers.map(item => ({...item, target:'paper', kind:item.documentType === 'previous-year-paper' || item.documentType === 'exam-paper' ? 'Paper / Question set' : 'Document / Question set'}))
          ];
          const editRecord = async row => {
            let result;
            try { result = await Api.auth('admin', {action:'validation-record', target:row.target, id:row.id}, token); }
            catch (error) { alert(error.message); return; }
            const record = result.record;
            window.App.modal(`<div class="admin-record-editor"><span class="eyebrow">EDIT BEFORE VALIDATION</span><h2>${esc(row.title)}</h2><p>Edit this record, save it, then validate it separately. Saving always returns the record to <b>Pending</b>. For any test-enabled document or question set, edit the <code>questions</code> array. Approval publishes the same questions in the readable view and the test.</p><textarea class="admin-editor" id="validationRecordEditor" spellcheck="false">${esc(JSON.stringify(record,null,2))}</textarea><div class="admin-tools"><button class="ghost-button" id="checkValidationRecord">Validate JSON</button><button class="primary-button" id="saveValidationRecord">Save changes</button></div><p class="admin-status" id="validationRecordStatus">Record ID cannot be changed. Public source links must be government URLs or Wayback snapshots of original government URLs.</p></div>`);
            const editor = document.getElementById('validationRecordEditor');
            const status = document.getElementById('validationRecordStatus');
            document.getElementById('checkValidationRecord').onclick = () => {
              try { JSON.parse(editor.value); status.textContent = 'Valid JSON. Saving will reset validation to Pending.'; }
              catch (error) { status.textContent = error.message; }
            };
            document.getElementById('saveValidationRecord').onclick = async event => {
              let edited;
              try { edited = JSON.parse(editor.value); } catch (error) { status.textContent = error.message; return; }
              if (!confirm('Save these edits? The record will remain hidden from students until it is approved again.')) return;
              event.currentTarget.disabled = true;
              status.textContent = 'Saving…';
              try {
                const saved = await Api.auth('admin', {action:'update-validation-record', target:row.target, id:row.id, record:edited}, token);
                row.status = saved.status;
                row.validatedBy = null;
                row.title = row.target === 'paper' ? (edited.title || row.title) : (edited.paper || row.title);
                window.App.closeModal();
                renderQueue();
              } catch (error) {
                status.textContent = error.message;
                event.currentTarget.disabled = false;
              }
            };
          };
          const renderQueue = () => {
            const pending = rows.filter(item => item.status === 'pending').length;
            const approved = rows.filter(item => item.status === 'approved').length;
            const rejected = rows.filter(item => item.status === 'rejected').length;
            workspace.innerHTML = `<h2>Content validation</h2><p><b>Edit → Save → Validate.</b> Documents, question sets and syllabus records are published to students only after approval.</p><div class="admin-metrics"><article><b>${pending}</b>Pending</article><article><b>${approved}</b>Approved</article><article><b>${rejected}</b>Rejected</article></div><div style="overflow:auto"><table class="admin-table"><thead><tr><th>Type</th><th>Record</th><th>Status</th><th>Validated by</th><th>Actions</th></tr></thead><tbody>${rows.map(item => `<tr><td>${esc(item.kind)}</td><td><strong>${esc(item.title)}</strong><br><small>${esc(item.examId || '')}${item.examDate ? ' · '+esc(item.examDate) : ''}${item.shift ? ' · Shift '+esc(item.shift) : ''}${item.questionCount ? ' · '+esc(item.questionCount)+' questions' : ''}${item.testEnabled ? ' · test enabled' : ''}</small></td><td><b>${esc(item.status)}</b></td><td>${esc(item.validatedBy || '—')}</td><td><button class="ghost-button" data-edit-target="${esc(item.target)}" data-edit-id="${esc(item.id)}">Edit</button> <button class="ghost-button" data-validate-target="${esc(item.target)}" data-validate-id="${esc(item.id)}" data-decision="approved">Approve</button> <button class="ghost-button" data-validate-target="${esc(item.target)}" data-validate-id="${esc(item.id)}" data-decision="rejected">Reject</button></td></tr>`).join('') || '<tr><td colspan="5">Nothing to validate.</td></tr>'}</tbody></table></div><p class="admin-status">Editing an approved record returns it to Pending until it is approved again.</p>`;
            workspace.querySelectorAll('[data-edit-target]').forEach(button => button.onclick = () => {
              const row = rows.find(item => item.target === button.dataset.editTarget && String(item.id) === String(button.dataset.editId));
              if (row) editRecord(row);
            });
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
      if (name === 'guide') workspace.innerHTML = `<h2>How to use the admin website</h2><p>This workflow keeps unreviewed academic content away from students.</p><ol class="admin-guide"><li><b>Import or create content.</b> Syllabus and previous-paper records enter the system as Pending.</li><li><b>Open Validation.</b> Find the syllabus, document or question-set record you want to review.</li><li><b>Edit before approval.</b> Click Edit and update metadata, source links and the <code>questions</code> array. Set <code>testEnabled</code> to true when the question set should also be attemptable as a test. The record remains Pending after saving.</li><li><b>Check the source rule.</b> Public source links are allowed only for government documents or Wayback snapshots of original government URLs. Other data can be retained without showing a source.</li><li><b>Approve or reject.</b> Test-enabled records cannot be approved without a valid question set. Approved records become visible to students; rejected and pending records remain hidden.</li><li><b>Re-edit safely.</b> Editing an approved record automatically returns it to Pending and removes it from the student view until approved again.</li><li><b>Use Exam content for bulk changes.</b> Load and edit JSON when many records need changes. Any syllabus or previous-paper file saved there is reset to Pending for revalidation.</li><li><b>Validate JSON and keep IDs stable.</b> Do not change record IDs that other data refers to.</li><li><b>Check the student website.</b> After approval, sign in as a student, choose the exam and verify the published syllabus/paper information.</li><li><b>Review students separately.</b> The Students section lists registrations; passwords and session tokens are never displayed.</li></ol><h3>Recommended publishing sequence</h3><p><b>Import → Edit → Save → Pending → Review → Approve → Student visibility.</b></p><p>Server backups are created before content saves and validation changes.</p>`;
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
          try{const result=await Api.auth('admin',{action:'save',file:loaded,content,revision},token);revision=result.revision;dirty=false;status.textContent = ['exam-syllabus.json','exams-old-papers.json'].includes(loaded) ? 'Saved to server. Records were reset to Pending; approve them in Validation before students can see them.' : 'Saved to server. Previous version backed up. Reload the website to check the update.';}catch(e){status.textContent=e.message;}finally{controls.forEach(b=>b.disabled=false);}
        };
      }
    }
    document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>panel(b.dataset.panel)); panel('overview');
  }};
}());
