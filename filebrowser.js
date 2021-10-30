/*
  github
*/

// toggle sidebar on click of bookmark
github.addEventListener('click', () => {

  toggleSidebar(!body.classList.contains('expanded'));

  saveSidebarStateLS();

})


// render sidebar
// call this function when signed in to github
// to render sidebar
async function renderSidebarHTML() {
  
  // if not already loading, start loading
  if (loader.style.opacity != '1') {
    startLoading();
  }
  
  // hide search screen
  header.classList.remove('searching');
  
  // map tree location
  const [user, repo, contents] = treeLoc;

  // get items in current tree from git
  const resp = await git.getItems(treeLoc);

  // save rendered HTML
  let out = '';

  // if response
  if (resp) {

    // show title

    sidebarLogo.classList.remove('overflow');

    if (contents != '') {

      // show path
      sidebarLogo.innerText = repo + contents;

      // if path is too long, overflow
      if (sidebarLogo.innerText.length > 25) {

        sidebarLogo.classList.add('overflow');

      }

    } else if (repo != '') {

      // show repo name
      sidebarLogo.innerText = repo;

    } else {

      // show title
      sidebarLogo.innerText = 'Repositories';

    }


    // if navigating in repository
    if (repo != '') {

      // render files
      resp.forEach(item => {

        // if item is a file
        if (item.type == 'file') {

          let file = getLatestVersion(item);

          // add modified flag to file
          let modified = '';
          if (modifiedFiles[file.sha] &&
              !modifiedFiles[file.sha].eclipsed) modified = ' modified';

          out += `
          <div class="item file`+ modified +`" sha="`+ file.sha +`">
            <div class="label">
              `+ fileIcon +`
              <a class="name">`+ file.name +`</a>
            </div>
            <div class="push-wrapper">
              `+ pushIcon +`
            </div>
          </div>
          `;

        } else { // if item is a folder

          out += `
          <div class="item folder">
            <div class="label">
              `+ folderIcon +`
              <a class="name">`+ item.name +`</a>
            </div>
            `+ arrowIcon +`
          </div>
          `;

        }

      });

    } else { // else, show all repositories

      // render repositories
      resp.forEach(item => {

        // if user does not have admin permissions in repo,
        // show admin name in title ([admin]/[repo])
        let fullName = item.permissions.admin ? item.name : item.full_name;

        out += `
        <div class="item repo" fullname="`+ item.full_name +`">
          <div class="label">
            `+ repoIcon +`
            <a class="name">`+ fullName +`</a>
          </div>
          `+ arrowIcon +`
        </div>
        `;

      });

    }

  }

  // add rendered HTML to dom
  fileWrapper.innerHTML = out;
  sidebar.scrollTo(0, 0);

  // stop loading
  stopLoading();

  // add item event listeners
  addHTMLItemListeners();

  // if selected file is in current directory
  if (selectedFile.dir == treeLoc.join()) {

    let selectedEl = fileWrapper.querySelector('.item[sha="'+ selectedFile.sha +'"]');

    if (selectedEl) {

      // select file
      selectedEl.classList.add('selected');
      selectedEl.scrollIntoViewIfNeeded();

    }
    
    // protect unsaved code
    protectUnsavedCode();

  }

}


// adds item event listeners
function addHTMLItemListeners() {

  let items = fileWrapper.querySelectorAll('.item');

  // run on all items
  items.forEach(item => {

    // navigate on click
    item.addEventListener('click', (e) => {

      // if item is a repository
      if (item.classList.contains('repo')) {

        // change location
        let itemLoc = getAttr(item, 'fullname').split('/');

        treeLoc[0] = itemLoc[0],
        treeLoc[1] = itemLoc[1];
        saveTreeLocLS(treeLoc);

        // render sidebar
        renderSidebarHTML();

      } else if (item.classList.contains('folder')) {

        // if item is a folder

        // change location
        treeLoc[2] += '/' + item.innerText;
        saveTreeLocLS(treeLoc);

        // render sidebar
        renderSidebarHTML();

      } else { // if item is a file

        // if not clicked on push button
        let pushWrapper = item.querySelector('.push-wrapper');
        let clickedOnPush = (e.target == pushWrapper);

        if (!clickedOnPush) {

          // if file not already selected
          if (!item.classList.contains('selected')) {

            // load file
            loadFileInHTML(item, getAttr(item, 'sha'));

          } else if (isMobile) { // if on mobile device

            // update bottom float
            updateFloat();

          }

        } else {

          // play push animation
          playPushAnimation(item.querySelector('.push-wrapper'));

          // push file
          pushFileFromHTML(item);

        }

      }

    })

  })

}


// push file to Git from HTML element
async function pushFileFromHTML(fileEl) {

  // disable pushing file in HTML
  fileEl.classList.remove('modified');
  bottomFloat.classList.remove('modified');

  // get file selected status
  const fileSelected = fileEl.classList.contains('selected');

  // create commit
  const commitMessage = 'Update ' + fileEl.innerText;
  const commitFile = fileSelected ? selectedFile : modifiedFiles[getAttr(fileEl, 'sha')];

  let commit = {
    message: commitMessage,
    file: commitFile
  };

  // push file asynchronously
  const newSha = await git.push(commit);

  // Git file is eclipsed (not updated) in browser private cache,
  // so store the updated file in modifiedFiles object for 1 minute after commit
  onFileEclipsedInCache(commit.file.sha, newSha);

}


// load file in sidebar and codeit
async function loadFileInHTML(fileEl, fileSha) {

  // if previous file selection exists
  if (selectedFile.sha) {

    // get previous selection in modifiedFiles array
    let selectedItem = modifiedFiles[selectedFile.sha];

    // if previous selection was modified
    if (selectedItem) {

      // save previous selection in localStorage
      updateModFileContent(selectedFile.sha, selectedFile.content);
      updateModFileCaretPos(selectedFile.sha, selectedFile.caretPos);
      updateModFileScrollPos(selectedFile.sha, selectedFile.scrollPos);

    }

  }


  // show all files
  let files = fileWrapper.querySelectorAll('.item[style="display: none;"]');
  files.forEach(file => { file.style.display = '' });
  
  header.classList.remove('searching');
  // clear existing selections
  if (fileWrapper.querySelector('.selected')) {
    fileWrapper.querySelector('.selected').classList.remove('selected');
  }


  // select the new file

  fileEl.classList.add('selected');
  fileEl.scrollIntoViewIfNeeded();

  // if file is not modified; fetch from Git
  if (!modifiedFiles[fileSha]) {

    // start loading
    startLoading();

    // get file from git
    const resp = await git.getFile(treeLoc, fileEl.innerText);

    // change selected file
    changeSelectedFile(treeLoc.join(), fileSha, fileEl.innerText, resp.content, getFileLang(fileEl.innerText),
                       [0, 0], [0, 0], false);

    // stop loading
    stopLoading();

  } else { // else, load file from modifiedFiles object

    const modFile = modifiedFiles[fileSha];

    changeSelectedFile(modFile.dir, modFile.sha, modFile.name, modFile.content, modFile.lang,
                       modFile.caretPos, modFile.scrollPos, false);

  }
  
  // show file content in codeit
  cd.textContent = decodeUnicode(selectedFile.content);
  
  // change codeit lang
  cd.lang = selectedFile.lang;

  // set caret pos in codeit
  cd.setSelection(selectedFile.caretPos[0], selectedFile.caretPos[1]);

  // set scroll pos in codeit
  cd.scrollTo(selectedFile.scrollPos[0], selectedFile.scrollPos[1]);

  // clear codeit history
  cd.history = [];

  // update line numbers
  updateLineNumbersHTML();

  // if on mobile device
  if (isMobile) {

    // update bottom float
    updateFloat();

  } else { // if on desktop

    // check codeit scrollbar
    checkScrollbarArrow();

  }

}


// traverse backwards in tree when clicked on button
sidebarTitle.addEventListener('click', () => {

  // map tree location
  const [user, repo, contents] = treeLoc;

  // if navigating in folders
  if (contents != '') {

    // pop last folder
    let splitContents = contents.split('/');
    splitContents.pop();

    // change location
    treeLoc[2] = splitContents.join('/');
    saveTreeLocLS(treeLoc);

    // render sidebar
    renderSidebarHTML();

  } else if (repo != '') { // if navigating in repository

    // change location
    treeLoc[1] = '';
    saveTreeLocLS(treeLoc);

    // render sidebar
    renderSidebarHTML();

  } else { // show learn page

    sidebar.classList.add('learn');

  }

})


// share codeit on click of button
learnShare.addEventListener('click', () => {

  const shareData = {
    title: 'Share Codeit',
    text: 'Hey, I\'m using Codeit to code. It\'s a mobile code editor connected to Git. Join me!',
    url: window.location.origin
  };

  try {

    navigator.share(shareData);

  } catch(err) {
    
    // if could not open share dialog, share on Twitter
    window.open('https://twitter.com/intent/tweet' +
                '?text=' + shareData.text.toLowerCase() +
                '&url=' + shareData.url, '_blank');
    
  }
  
})

// close learn page on click of button
learnClose.addEventListener('click', () => {

  sidebar.classList.remove('learn');

})


// toggle the sidebar
function toggleSidebar(open) {

  if (open) {

    body.classList.add('expanded');

    if (isMobile) {
      document.querySelector('meta[name="theme-color"]').content = '#1a1c24';
    }

  } else {

    body.classList.remove('expanded');

    if (isMobile) {
      document.querySelector('meta[name="theme-color"]').content = '#313744';
    }

  }

}


// when scrolled editor, save new scroll position

let editorScrollTimeout;

function onEditorScroll() {

  if (editorScrollTimeout) window.clearTimeout(editorScrollTimeout);

  // when stopped scrolling, save scroll pos
  editorScrollTimeout = window.setTimeout(saveSelectedFileScrollPos, 300);

}

function checkScrollbarArrow() {

  window.setTimeout(() => {

    // if codeit is horizontally scrollable
    if (cd.scrollWidth > cd.clientWidth) {

      // move sidebar arrow up to make
      // way for horizontal scrollbar
      github.classList.add('scrollbar');

    } else {

      github.classList.remove('scrollbar');

    }

  }, 0);

}

// check for meta key (Ctrl/Command)
function isKeyEventMeta(event) {
  return event.metaKey || event.ctrlKey;
}

// called on code change event
function codeChange() {

  // if selected file is not in modifiedFiles
  // or if it is in modifiedFiles and eclipsed
  if (!modifiedFiles[selectedFile.sha] ||
      (modifiedFiles[selectedFile.sha] &&
       modifiedFiles[selectedFile.sha].eclipsed)) {

    // add selected file to modifiedFiles
    addSelectedFileToModFiles();

    // enable pushing file in HTML

    const selectedEl = fileWrapper.querySelector('.item[sha="'+ selectedFile.sha +'"]');

    // if selected file element exists in HTML
    if (selectedEl) {

      // enable pushing file
      selectedEl.classList.add('modified');

      // enable pushing from bottom float
      bottomFloat.classList.add('modified');

    }

  }

  // update line numbers
  updateLineNumbersHTML();

  // save code in async thread
  asyncThread(saveSelectedFileContent, 30);

}

// protect unsaved code
// if selected file is in current directory
// but does not exist in the HTML
function protectUnsavedCode() {

  // get selected file element in HTML
  const selectedEl = fileWrapper.querySelector('.item[sha="'+ selectedFile.sha +'"]');

  // if selected file is not in HTML,
  // protect unsaved code by clearing codeit
  if (selectedEl == null) {

    // clear codeit

    // clear codeit contents
    cd.textContent = '';

    // change codeit lang
    cd.lang = '';

    // clear codeit history
    cd.history = [];

    // update line numbers
    updateLineNumbersHTML();
    
    // if on mobile, show sidebar
    if (isMobile) {
      
      // don't transition
      body.classList.add('notransition');

      // show sidebar
      toggleSidebar(true);
      saveSidebarStateLS();

      onNextFrame(() => {

        body.classList.remove('notransition');

      });
      
    }
    
    // change selected file to empty file
    changeSelectedFile('', '', '', '', '', [0, 0], [0, 0], false);

  }

}

function setupEditor() {
  
  // if code in storage
  if (selectedFile.content) {

    // set codeit to code
    cd.lang = selectedFile.lang || 'plain';
    cd.textContent = decodeUnicode(selectedFile.content);
    
    // if sidebar isn't expanded, focus codeit
    if (!(isMobile && body.classList.contains('expanded'))) {
      
      // set caret pos in code
      cd.setSelection(selectedFile.caretPos[0], selectedFile.caretPos[1]);
      
    }

    // scroll to pos in code
    cd.scrollTo(selectedFile.scrollPos[0], selectedFile.scrollPos[1]);

    // update line numbers
    updateLineNumbersHTML();

  }
  
  
  // add editor event listeners
  
  cd.on('modify', codeChange);
  cd.on('scroll', onEditorScroll);
  cd.on('caretmove', saveSelectedFileCaretPos);
  
  if (!isMobile) cd.on('modify scroll', checkScrollbarArrow);
  
  // update on screen resize
  window.addEventListener('resize', () => {

    // update line numbers
    updateLineNumbersHTML();

    // check codeit scrollbar
    if (!isMobile) checkScrollbarArrow();

  });
  
  // update line numbers when finished highlighting
  Prism.hooks.add('complete', function (env) {

    if (!env.code) {
      return;
    }

    // update line numbers
    updateLineNumbersHTML();

  });
  
  // disable context menu
  if (!isMobile) {
  
    window.addEventListener('contextmenu', (e) => {

      e.preventDefault();

    });
    
  }

  // disable Ctrl/Cmd+S
  document.addEventListener('keydown', (e) => {

    if (e.key === 's' && isKeyEventMeta(e)) {

      e.preventDefault();

      if (isMac) console.log('[Cmd+S] Always saving. Always saving.');
      else console.log('[Ctrl+S] Always saving. Always saving.');

    }

  });

}

function updateLineNumbersHTML() {

  // if mobile but not in landscape,
  // or if editor isn't in view, return
  if (isMobile && !isLandscape) {
    
    if (cd.querySelector('.line-numbers-rows')) {

      cd.querySelector('.line-numbers-rows').remove();

    }

    cd.classList.remove('line-numbers');
    cd.style.setProperty('--gutter-length', '');

    return;
    
  }

  cd.classList.add('line-numbers');

  // update line numbers
  Prism.plugins.lineNumbers.resize(cd);

}

function setupSidebar() {

  // if not logged in to Github
  if (githubToken == null) {

    // show intro screen
    sidebar.classList.add('intro');

    // don't transition
    body.classList.add('notransition');

    // show sidebar
    toggleSidebar(true);
    saveSidebarStateLS();
    
    onNextFrame(() => {

      body.classList.remove('notransition');

    });

  } else { // if logged in to Github

    // render sidebar
    renderSidebarHTML();

    // if sidebar is open
    if (getStorage('sidebar') == 'true') {

      // don't transition
      body.classList.add('notransition');

      toggleSidebar(true);

      onNextFrame(() => {

        body.classList.remove('notransition');

      });

    } else if (isMobile) {

      // update bottom floater
      updateFloat();

    }

  }

}

function setupCodeitApp() {

  setupEditor();
  setupSidebar();

  setTimeoutForEclipsedFiles();

}
