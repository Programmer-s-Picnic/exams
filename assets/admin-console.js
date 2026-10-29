(function () {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderAdminLogin(mount, state, message = '') {
    mount.innerHTML = `<section class="admin-standalone"><div class="admin-login-card"><img src="favicon.svg?v=upnaukriguru" alt="" width="64" height="64"><span class="eyebrow">UP NAUKRIGURU ADMINISTRATION</span><h1>Admin sign in</h1><p>Use an authorised administrator account.</p>${message ? `<p class="form-error">${esc(message)}</p>` : ''}<label>Email or mobile<input id="adminLoginId" autocomplete="username" placeholder="Registered Exams email or mobile"></label><label>Password<input id="adminLoginPassword" type="password" autocomplete="current-password"></label><button class="primary-button full" id="adminLoginButton">Sign in</button><p class="admin-status" id="adminLoginStatus"></p><p class="admin-developer-credit">Developed and maintained by <strong>Champak Roy</strong></p></div></section>`;
    const button = document.getElementById('adminLoginButton');
    button.onclick = async () => {
      const login = document.getElementById('adminLoginId').value.trim();
      const password = document.getElementById('adminLoginPassword').value;
      const status = document.getElementById('adminLoginStatus');
      if (!login || !password) { status.textContent = 'Enter your login and password.'; return; }
      button.disabled = true; status.textContent = 'Signing in…';
      try {
        const testing = login === 'admin';
        const result = testing
          ? await Api.auth('admin', {action:'temporary-login', username:login, password})
          : await Api.auth('login', {login, password});
        await Api.auth('admin', undefined, result.token);
        sessionStorage.setItem('he_admin_token', result.token);
        await window.AdminConsole.render(state, result.token);
      } catch (error) {
        status.textContent = login === 'admin' && /Temporary admin testing is unavailable/i.test(error.message)
          ? 'Temporary admin testing has expired or is disabled. Sign in using your registered, authorised administrator email or mobile number and its password. The temporary password cannot be used for permanent login.'
          : error.message;
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
    mount.innerHTML = `<section class="admin-standalone"><header class="admin-shell-header"><div><img src="favicon.svg?v=upnaukriguru" alt="" width="48" height="48"><span><strong>UP NaukriGuru Administration</strong><small>Content, validation and student management</small></span></div><div><a class="ghost-button" href="#/landing">Open student site</a><button class="ghost-button" id="adminSignOut" type="button">Sign out</button></div></header><div class="page admin-page"><div class="page-hero compact"><span class="eyebrow">ADMINISTRATION</span><h1>Administration dashboard</h1><p>Manage exam content, validations and student registrations.</p></div><div class="admin-console"><aside class="admin-menu"><button data-panel="overview" class="active">Overview</button><button data-panel="validation">Validation</button><button data-panel="builder">Test builder</button><button data-panel="content">Exam content</button><button data-panel="students">Students</button><button data-panel="guide">How to use</button></aside><article class="admin-workspace" id="adminWorkspace"></article></div></div><footer class="admin-product-footer">Developed and maintained by <strong>Champak Roy</strong></footer></section>`;
    document.getElementById('adminSignOut').onclick = async () => {
      if (info.testing) {
        try { await Api.auth('admin', {action:'temporary-logout'}, token); } catch (_) {}
      }
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
      if (name === 'overview') workspace.innerHTML = `<h2>Portal overview</h2><div class="admin-metrics"><article><b>${state.exams.length}</b>Exams</article><article><b>${state.tests.length}</b>Test papers</article><article><b>${info.studentCount}</b>Registered students</article></div><h3>Content workflow</h3><p>Use <b>Test builder</b> for new practice tests, diagnostics and multiple-choice questions—no JSON required. Use <b>Validation</b> for syllabus and previous-paper approvals. Use <b>Exam content</b> for technical editing of other records. The server backs up content before saving.</p>`;
      if (name === 'builder') {
        workspace.innerHTML = '<div id="testBuilderMount"></div>';
        if (!window.ExamTestBuilder) {
          workspace.innerHTML = '<h2>Test builder unavailable</h2><p>Refresh this page to load the guided editor.</p>';
          return;
        }
        await window.ExamTestBuilder.mount(workspace.querySelector('#testBuilderMount'), {
          Api, token, exams: state.exams,
          onDirtyChange(value) { dirty = value; }
        });
      }
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
            window.App.modal(`<div class="admin-record-editor"><header class="admin-record-heading"><span class="eyebrow">EDIT BEFORE VALIDATION</span><h2>${esc(row.title)}</h2><p>Use the visual fields to edit this record. Saving returns it to <b>Pending</b>, and approval is a separate step.</p></header><div class="admin-record-scroll" role="region" tabindex="0" aria-label="Scroll validation record fields"><div id="validationVisualEditor"></div><details id="validationAdvancedPane"><summary>Advanced JSON (technical administrators)</summary><textarea class="admin-editor" id="validationRecordEditor" spellcheck="false">${esc(JSON.stringify(record,null,2))}</textarea><button class="ghost-button" type="button" id="validationApplyJson">Apply JSON to form</button></details></div><footer class="admin-record-footer"><div class="admin-tools"><button class="ghost-button" id="checkValidationRecord">Validate JSON</button><button class="primary-button" id="saveValidationRecord">Save changes</button></div><p class="admin-status" id="validationRecordStatus">Record ID cannot be changed. Public source links must be government URLs or Wayback snapshots of original government URLs.</p></footer></div>`);
            document.getElementById('appModal')?.classList.add('admin-validation-modal');
            const editor = document.getElementById('validationRecordEditor');
            const status = document.getElementById('validationRecordStatus');
            const visual = window.ExamVisualEditor.mount(document.getElementById('validationVisualEditor'),record,value=>{editor.value=JSON.stringify(value,null,2);status.textContent='Unsaved form changes.';});
            document.getElementById('validationApplyJson').onclick=()=>{try{visual.setValue(JSON.parse(editor.value));status.textContent='Advanced changes applied to form.';}catch(e){status.textContent=e.message;}};
            document.getElementById('checkValidationRecord').onclick = () => {
              try { JSON.parse(JSON.stringify(visual.getValue())); status.textContent = 'Valid JSON. Saving will reset validation to Pending.'; }
              catch (error) { status.textContent = error.message; }
            };
            document.getElementById('saveValidationRecord').onclick = async event => {
              let edited;
              try { edited = visual.getValue(); } catch (error) { status.textContent = error.message; return; }
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
            workspace.innerHTML = `<h2>Content validation</h2><p><b>Edit → Save → Validate.</b> Documents, question sets and syllabus records are published to students only after approval.</p><div class="admin-metrics"><article><b>${pending}</b>Pending</article><article><b>${approved}</b>Approved</article><article><b>${rejected}</b>Rejected</article></div><div style="overflow:auto"><table class="admin-table"><thead><tr><th>Type</th><th>Record</th><th>Status</th><th>Validated by</th><th>Actions</th></tr></thead><tbody>${rows.map(item => `<tr><td>${esc(item.kind)}</td><td><strong>${esc(item.title)}</strong><br><small>${esc(item.examId || '')}${item.examDate ? ' · '+esc(item.examDate) : ''}${item.shift ? ' · Shift '+esc(item.shift) : ''}${item.questionCount ? ' · '+esc(item.questionCount)+' questions' : ''}${item.testEnabled ? ' · test enabled' : ''}</small></td><td><b>${esc(item.status)}</b></td><td>${esc(item.validatedBy || '—')}</td><td><button class="ghost-button" data-edit-target="${esc(item.target)}" data-edit-id="${esc(item.id)}">Edit</button> <button class="ghost-button" data-validate-target="${esc(item.target)}" data-validate-id="${esc(item.id)}" data-decision="approved" ${item.status === 'approved' ? 'disabled aria-disabled="true" title="Already approved. Edit and save this record to enable approval again."' : ''}>Approve</button> <button class="ghost-button" data-validate-target="${esc(item.target)}" data-validate-id="${esc(item.id)}" data-decision="rejected">Reject</button></td></tr>`).join('') || '<tr><td colspan="5">Nothing to validate.</td></tr>'}</tbody></table></div><p class="admin-status">Approved records cannot be approved twice. Edit and save an approved record to return it to Pending and enable Approve again.</p>`;
            workspace.querySelectorAll('[data-edit-target]').forEach(button => button.onclick = () => {
              const row = rows.find(item => item.target === button.dataset.editTarget && String(item.id) === String(button.dataset.editId));
              if (row) editRecord(row);
            });
            workspace.querySelectorAll('[data-validate-target]').forEach(button => button.onclick = async () => {
              const decision = button.dataset.decision;
              const target = button.dataset.validateTarget;
              const id = button.dataset.validateId;
              // A saved edit resets server approval to Pending before reapproval.
              const current = rows.find(item => item.target === target && String(item.id) === String(id));
              if (decision === 'approved' && current?.status === 'approved') return;
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
      if (name === 'guide') workspace.innerHTML = `<h2>How to use NaukriPreps Administration</h2>
        <p><strong>For most new tests, use Test builder.</strong> It has ordinary forms. You do not need to know JSON, question IDs or answer numbers.</p>
        <h3>1. Create a new practice or mock test</h3>
        <ol class="admin-guide">
          <li>Open <b>Test builder</b> in the admin menu, then choose <b>+ New test</b>.</li>
          <li>Enter a clear name such as <b>UP Police Constable — Reasoning Practice 1</b>, a subject/category and a short description.</li>
          <li>Choose <b>Practice / Mock Test</b>. Select <b>Logged-in Diagnostic</b> only if this should be a diagnostic for registered students. The existing free guest diagnostic is kept separate.</li>
          <li>Tick the examination(s) where the test belongs. Enter the time limit in <b>minutes</b>, marks deducted for a wrong answer (enter 0 for none), and the pass percentage.</li>
          <li>Leave <b>Make this test available to students</b> <b>OFF</b> while preparing it.</li>
        </ol>
        <h3>2. Enter questions one at a time</h3>
        <ol class="admin-guide">
          <li>Click <b>+ Add question</b>. Type the question and its topic. Enter how many marks a correct answer earns.</li>
          <li>Fill in the four answer choices marked <b>A, B, C and D</b>.</li>
          <li>Click the round selector beside the <b>correct answer</b>. You do not enter numbers such as 0 or 1; the website handles answer numbering.</li>
          <li>Add an <b>Explanation</b> for the student answer review. A programming question can optionally include a code snippet.</li>
          <li>Check the <b>Student preview</b>. The correct choice is highlighted <b>only in the admin preview</b>.</li>
          <li>Choose <b>+ Add question</b> again, or <b>Duplicate</b> a similar question and change its text, options and correct answer. Use <b>Move up</b> and <b>Move down</b> to change order, or <b>Delete</b> to remove a question.</li>
        </ol>
        <p><b>Example:</b> Question: What is 5 + 3? Options: A = 6, B = 7, C = 8, D = 9. Select the correct-answer circle beside <b>C</b>. Explanation: 5 + 3 = 8.</p>
        <h3>3. Check your test and save</h3>
        <ol class="admin-guide">
          <li>Choose <b>Check test</b>. Fix any missing test title, exam, question text, topic, choice, correct answer or marks.</li>
          <li>Choose <b>Save to server</b>. The server checks the latest file version and saves a backup. <b>Saving is not a private editorial draft:</b> it updates tests.json on the server.</li>
          <li>If Visibility was OFF, the test cannot be taken by students (some screens may show it as Coming soon). When the test is completely reviewed, switch Visibility ON and <b>Save to server again</b>.</li>
          <li>Reload the student website and confirm the right exam, every question, correct-answer feedback, timing and final score.</li>
        </ol>
        <p><b>To correct a test later:</b> open Test builder, select it from the list, fix the details or questions and save. Previously existing internal test and question IDs are preserved.</p>
        <h3>4. Separate workflow for old papers and syllabuses</h3>
        <p>The Test builder is for practice tests and logged-in diagnostics. Previous-year papers, uploaded documents and syllabus records use <b>Validation → Edit → Save → Approve</b>. An edited approved record returns to Pending until approved again.</p>
        <h3>5. Advanced content editing</h3>
        <p>Use the visual editor to manage examination information without typing JSON. Only authorised administrators may access this section.</p>
        <h4>Editing other JSON-backed content</h4>
        <ol class="admin-guide">
          <li>Open <b>Exam content</b> from the left menu.</li>
          <li>Select a content file from the dropdown and click <b>Load file</b>. The file appears as labelled fields, groups and expandable records.</li>
          <li>Click a record to open it. Change the relevant text or number. For question sets, edit the question, options, answer, explanation and exam/topic information.</li>
          <li>Use <b>Duplicate</b> to start with a similar record or <b>Remove</b> to delete one from your unsaved copy. Review automatic IDs when duplicating records.</li>
          <li>Use <b>Search</b> to locate text. Use <b>Download copy</b> to keep a personal JSON export before changes.</li>
          <li>Click <b>Validate JSON</b> to check syntax, then <b>Save to server</b> and confirm. The server performs additional structural checks and creates a backup before replacing the file.</li>
        </ol>
        <p><strong>Important:</strong> Save to server is not a private draft. It writes to the existing content store. For syllabus and previous-paper records, saving resets approval to Pending; those records must be reapproved in Validation before students see them. Other allowed files may change the student-facing data immediately.</p>
        <h3>6. Review syllabus and previous-year question sets</h3>
        <ol class="admin-guide">
          <li>Open <b>Validation</b>, locate the record and select <b>Edit</b>.</li>
          <li>Use the visual form to correct record fields. For test-enabled papers, verify the full questions list and correct answers.</li>
          <li>Save the changes. The record returns to <b>Pending</b>. <b>Approve</b> is disabled on an Approved record and becomes available again only after edits are saved.</li>
          <li>Check the source rule: public citations must link to a government site or a Wayback snapshot of an original government document. Material without such an official source must not be given an unsupported source link.</li>
          <li>Choose <b>Approve</b> to make a validated record available to students, or <b>Reject</b> for corrections. Verify the result on the student website.</li>
        </ol>
        <h3>7. Technical and safety notes</h3>
        <p>Open <b>Advanced JSON editor</b> only when you understand the data structure. If you change its text, click <b>Apply JSON changes to visual editor</b> before saving. Keep existing IDs unchanged because other records refer to them. Do not edit account data or report cards through the content editor.</p>
        <p>Currently the content selector displays only the files explicitly permitted by the server. Excel/CSV import, MySQL editorial drafts and delegated subadmin publishing are not active in this release.</p>
        <h3>8. Check your work</h3>
        <p>After saving, revisit the file to confirm the updated values. After approving a paper, open the student site and confirm that the syllabus, paper display, test questions and answers behave correctly. The <b>Students</b> area is read-only for registrations and does not expose passwords or session tokens.</p>
        <p><strong>Current workflow:</strong> Load → Edit → Check → Save → (if approval-required) Validate → Student preview.</p>`;
      if (name === 'students') {
        workspace.innerHTML = '<p>Loading students…</p>';
        try { const result = await Api.auth('admin', {action:'students'}, token); if (!workspace.isConnected) return; workspace.innerHTML = `<h2>Registered students</h2><p>Latest 200 registrations.</p><div style="overflow:auto"><table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Mobile</th></tr></thead><tbody>${result.students.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.mobile)}</td></tr>`).join('') || '<tr><td colspan="3">No registrations yet.</td></tr>'}</tbody></table></div>`; } catch (e) {workspace.textContent = e.message;}
      }
      if (name === 'content') {
        workspace.innerHTML = `<h2>Visual content editor</h2><p>Edit content using ordinary fields and expandable records. <strong>Save to server publishes the existing file</strong> (syllabus and previous-paper records return to Pending validation). Download a copy before major changes.</p><label for="adminFile">Content file</label><div class="admin-tools"><select id="adminFile">${info.files.map(f=>`<option>${esc(f)}</option>`).join('')}</select><button class="ghost-button" id="loadContent">Load file</button></div><div id="adminFileHelp" class="admin-file-help" role="note" aria-live="polite"></div><div id="visualEditorHost" aria-label="Visual content editor"></div><details id="advancedEditorPane"><summary>Advanced JSON editor (technical administrators only)</summary><p>Changes made in this technical view are reflected when you choose Apply JSON below.</p><textarea class="admin-editor" id="contentEditor" aria-label="JSON content" spellcheck="false" disabled></textarea><button type="button" class="ghost-button" id="applyAdvancedJSON" disabled>Apply JSON changes to visual editor</button></details><div class="admin-tools"><button id="validateContent" class="ghost-button" disabled>Validate JSON</button><button id="downloadContent" class="ghost-button" disabled>Download copy</button><button id="saveContent" class="primary-button" disabled>Save to server</button></div><p class="admin-status" id="adminStatus" role="status">Select a file and load it to begin.</p>`;
        const editor = document.getElementById('contentEditor'), select = document.getElementById('adminFile'), status = document.getElementById('adminStatus'); let revision, loaded;
        let visual = null;
        const controls = ['validateContent','downloadContent','saveContent'].map(id=>document.getElementById(id));
        const fileHelp = {
          'site-main.json': {title:'Website settings',usage:'Controls the website name, navigation menus, homepage text and feature switches.',format:'Contains four groups: site, navigation, content and features. Open each group to edit its labelled fields.',tip:'Changing navigation routes or feature settings can affect the live student website.'},
          'exams.json': {title:'Examination master',usage:'Lists available examinations and the information students see when selecting an exam.',format:'The exams list contains one record per examination: ID, name, authority, subjects, availability and related details. overlapGroups describes shared syllabus areas.',tip:'Keep existing exam IDs unchanged; tests, papers and syllabuses reference them.'},
          'tests.json': {title:'Practice tests and diagnostics',usage:'Defines test papers, diagnostic settings, marking schemes, questions and exam links.',format:'The tests list holds one test per record, including its ID, title, audience, exam association and test rules; open each record to inspect the remaining fields.',tip:'Check question answers, time limits and guest versus signed-in settings carefully before saving.'},
          'exam-syllabus.json': {title:'Exam syllabuses',usage:'Defines each exam’s syllabus, subject sections, question distribution, marks and topics.',format:'The syllabi list contains examination records; each record includes sections and topic lists. updatedAt stores a content timestamp.',tip:'Saving syllabus content sends affected records back to Pending; approve them again in Validation.'},
          'exams-old-papers.json': {title:'Previous-year papers',usage:'Stores previous examination documents and question sets, with publication and source-verification information.',format:'The papers list contains individual papers with exam, date, shift and question details. There are also sources, policy and updatedAt fields.',tip:'Saving these records resets approval to Pending. Use Validation to review and approve before students can view them.'}
        };
        const helpBox = document.getElementById('adminFileHelp');
        function explainFile(content) {
          const item = fileHelp[select.value] || {title:'Content file',usage:'Stores website content in labelled records.',format:'Fields, groups and lists are displayed in the visual editor.',tip:'Download a copy and verify all changes before saving.'};
          helpBox.replaceChildren();
          const heading = document.createElement('strong'); heading.textContent = item.title;
          const usage = document.createElement('p'); usage.textContent = item.usage;
          const format = document.createElement('p'); format.textContent = 'Format: ' + item.format;
          const tip = document.createElement('p'); tip.textContent = 'Before saving: ' + item.tip;
          helpBox.append(heading,usage,format,tip);
          if(content && typeof content === 'object') {
            const keys = Object.keys(content).filter(k=>Array.isArray(content[k]));
            if(keys.length) {
              const counts = document.createElement('small');
              counts.textContent = 'In the loaded file: ' + keys.map(k=>k+' ('+content[k].length+' records)').join(' · ');
              helpBox.append(counts);
            }
          }
        }
        select.addEventListener('change',()=>{if(loaded!==select.value){document.getElementById('visualEditorHost').replaceChildren();visual=null;loaded=null;revision=null;editor.value='';editor.disabled=true;controls.forEach(b=>b.disabled=true);document.getElementById('applyAdvancedJSON').disabled=true;dirty=false;status.textContent='Click Load file to open the selected content.';}explainFile();});
        explainFile();
        document.getElementById('loadContent').onclick = async () => {
          if (dirty && !confirm('Discard your unsaved changes?')) return;
          controls.forEach(b=>b.disabled=true); editor.disabled=true; status.textContent='Loading…';
          try { const result = await Api.auth('admin',{action:'load',file:select.value},token); loaded=select.value; revision=result.revision; explainFile(result.content); editor.value=JSON.stringify(result.content,null,2); visual=window.ExamVisualEditor.mount(document.getElementById('visualEditorHost'),result.content,value=>{editor.value=JSON.stringify(value,null,2);dirty=true;status.textContent='Unsaved changes. Publishing requires confirmation.';});document.getElementById('applyAdvancedJSON').disabled=false; dirty=false; editor.disabled=false; controls.forEach(b=>b.disabled=false); status.textContent=`Loaded ${loaded}.`; } catch(e) {status.textContent=e.message;}
        };
        editor.oninput=()=>{dirty=true;status.textContent='Unsaved advanced JSON changes. Apply JSON changes before saving.';};
        document.getElementById('applyAdvancedJSON').onclick=()=>{try{const data=JSON.parse(editor.value);if(!visual)throw Error('Load a file first.');visual.setValue(data);dirty=true;status.textContent='Advanced JSON applied to visual editor. Not yet published.';}catch(e){status.textContent=e.message}};
        controls[0].onclick=()=>{try{if(visual)editor.value=JSON.stringify(visual.getValue(),null,2);JSON.parse(editor.value);status.textContent='Valid JSON syntax. The server also checks the file structure on save.';}catch(e){status.textContent=e.message;}};
        controls[1].onclick=()=>{const output=visual?JSON.stringify(visual.getValue(),null,2):editor.value;const url=URL.createObjectURL(new Blob([output],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download=loaded;a.click();URL.revokeObjectURL(url);};
        controls[2].onclick=async()=>{
          let content;try{content=visual?visual.getValue():JSON.parse(editor.value);}catch(e){status.textContent=e.message;return;}
          if(!confirm(`Publish changes to ${loaded}? This changes the live content after server validation. Make sure the visual editor has the intended information.`))return;
          controls.forEach(b=>b.disabled=true);status.textContent='Saving…';
          try{const result=await Api.auth('admin',{action:'save',file:loaded,content,revision},token);revision=result.revision;dirty=false;status.textContent = ['exam-syllabus.json','exams-old-papers.json'].includes(loaded) ? 'Saved to server. Records were reset to Pending; approve them in Validation before students can see them.' : 'Saved to server. Previous version backed up. Reload the website to check the update.';}catch(e){status.textContent=e.message;}finally{controls.forEach(b=>b.disabled=false);}
        };
      }
    }
    document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>panel(b.dataset.panel)); panel('overview');
  }};
}());
