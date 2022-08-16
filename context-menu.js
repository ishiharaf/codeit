
// fix browser object parsing
let contextMenu = {
  el: document.querySelector('.context-menu')
};

contextMenu = {
  
  el: document.querySelector('.context-menu'),
  
  options: {
    push: contextMenu.el.querySelector('.push'),
    rename: contextMenu.el.querySelector('.rename'),
    addToNewFolder: contextMenu.el.querySelector('.add-to-new-folder'),
    discardChanges: contextMenu.el.querySelector('.discard-changes'),
    deleteItem: contextMenu.el.querySelector('.delete')
  },
    
  activeEl: null,
  
  addOptionListeners: () => {
    
    const options = contextMenu.options;
    
    options.push.addEventListener('click', async () => {
      
      const dialogResp = await checkPushDialogs();
    
      if (dialogResp === 'return') return;
      
      pushFileWithCommitMessageHTML(contextMenu.activeEl);
      
    });
    
    options.discardChanges.addEventListener('click', () => {
      
      deleteModFileInHTML(contextMenu.activeEl);
      
    });
    
  },
  
  addFileListener: (file) => {
    
    if (!isMobile) {
      
      file.addEventListener('contextmenu', async (e) => {
        
        contextMenu.activeEl = file;
        file.classList.add('active');
        
        contextMenu.el.style.top = e.clientY + 'px';
        contextMenu.el.style.left = e.clientX + 'px';
        
        contextMenu.el.classList.add('visible', 'animating');
        
        contextMenu.el.classList.toggle('modified', file.classList.contains('modified'));
        
        window.setTimeout(() => {
          
          contextMenu.el.classList.remove('animating');
          
        }, 180);
        
      });
      
    }
      
  }
  
}

contextMenu.addOptionListeners();


sidebar.addEventListener('scroll', () => {

  if (contextMenu.el.classList.contains('visible')) {

    contextMenu.el.classList.remove('visible');
    contextMenu.activeEl.classList.remove('active');

  }

});

document.addEventListener('mousedown', (e) => {
  
  if (contextMenu.el.classList.contains('visible')) {
    
    if (e.target.parentElement !== contextMenu.el &&
        e.target.parentElement.parentElement !== contextMenu.el) {
      
      contextMenu.el.classList.remove('visible');
      contextMenu.activeEl.classList.remove('active');
      
    }
    
  }
  
});

contextMenu.el.addEventListener('click', () => {
  
  contextMenu.el.classList.remove('visible');
  contextMenu.activeEl.classList.remove('active');
  
});



// disable context menu
if (!isMobile) {

  window.addEventListener('contextmenu', (e) => {

    e.preventDefault();

  });

}

