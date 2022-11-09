// ==UserScript==
// @name Cohost Dedup
// @namespace https://nex-3.com
// @version 1.0
// @description Deduplicate posts you've already seen on Cohost
// @author Natalie Weizenbaum
// @match https://cohost.org/*
// @match https://*.cohost.org/*
// ==/UserScript==

const hiddenChostsHeight = '150px';

const style = document.createElement("style");
style.innerText = `
  @property --cohost-dedup-opacity {
    syntax: '<number>';
    initial-value: 1;
    inherits: false;
  }

  .-cohost-dedup-hidden-chost, .-cohost-dedup-hidden-thread {
    display: none;
  }

  .-cohost-dedup-hidden-chost.-cohost-dedup-last {
    display: block;
    height: ${hiddenChostsHeight};
    position: relative;
    overflow: hidden;
    margin-bottom: -${hiddenChostsHeight};
  }

  .-cohost-dedup-hidden-chost.-cohost-dedup-last > :not(div:not(.flex)) {
    display: none;
  }

  .-cohost-dedup-hidden-chost.-cohost-dedup-last > div:not(.flex) {
    position: absolute;
    bottom: 0;
  }

  .-cohost-dedup-link {
    --cohost-dedup-opacity: 0.5;
    color: rgb(130 127 124 / var(--cohost-dedup-opacity));
    font-size: 2rem;
    display: block;
    text-align: center;
    height: ${hiddenChostsHeight};
    padding-top: calc(${hiddenChostsHeight} - 35px);
    background: linear-gradient(0deg,
        rgb(255 255 255 / calc(1 - var(--cohost-dedup-opacity))), white);
    position: relative;
    transition: --cohost-dedup-opacity 0.5s;
    margin-bottom: 10px;
  }

  .-cohost-dedup-link:hover {
    --cohost-dedup-opacity: 1;
  }
`;
document.head.appendChild(style);

function getChosts(thread) {
  return thread.querySelectorAll(":scope > article > div");
}

function getChostLink(chost) {
  return chost.querySelector(":scope > :nth-child(2) time > a")?.href ??
      chost.parentElement.querySelector(":scope > header time > a").href;
}

function hasTags(chost) {
  return !!chost.querySelector("a.inline-block.text-gray-400");
}

function hideChost(chost) {
  chost.classList.add('-cohost-dedup-hidden-chost');
  chost.classList.add('-cohost-dedup-last');
  const prev = chost.previousSibling;
  if (prev?.classList?.contains("-cohost-dedup-link")) {
    prev.previousSibling.classList.remove('-cohost-dedup-last');
    prev.href = getChostLink(chost);
    prev.before(chost);
  } else {
    const a = document.createElement("a");
    a.classList.add("-cohost-dedup-link");
    a.href = getChostLink(chost);
    a.innerText = "...";
    chost.after(a);
    a.onclick = event => {
      const prev = a.previousSibling;
      prev.classList.remove("-cohost-dedup-hidden-chost");
      prev.classList.remove("-cohost-dedup-last");

      if (prev.previousSibling?.classList
          ?.contains("-cohost-dedup-hidden-chost")) {
        prev.previousSibling.classList.add("-cohost-dedup-last");
        prev.previousSibling.after(a);
      } else {
        a.remove();
      }
      return false;
    };
  }

  if (chost.nextSibling.nextSibling.nodeName !== 'DIV' && !hasTags(chost)) {
    chost.parentElement.parentElement.parentElement.classList
        .add('-cohost-dedup-hidden-thread');
  }
}

class SessionStoreSet {
  constructor(name) {
    this.name = name;
    const stored = window.sessionStorage.getItem(name);
    this.set = stored === null ? new Set() : new Set(JSON.parse(stored));
  }

  has(value) {
    return this.set.has(value);
  }

  add(value) {
    this.set.add(value);
    window.sessionStorage.setItem(this.name, JSON.stringify([...this.set]));
  }
}

const seenChostIds = new SessionStoreSet('-cohost-dedup-seen-chost-ids');
const shownChostFullIds =
    new SessionStoreSet('-cohost-dedup-shown-chost-full-ids');
function checkThread(thread) {
  const threadId = thread.dataset.testid;
  if (!threadId) return;
  console.log(`Checking ${threadId}`);

  for (const chost of getChosts(thread)) {
    const id = getChostLink(chost);
    const fullId = `${threadId} // ${id}`;
    if (seenChostIds.has(id) && !shownChostFullIds.has(fullId)) {
      console.log(`Hiding chost ${id}`);
      hideChost(chost);
    } else {
      seenChostIds.add(id);
      shownChostFullIds.add(fullId);
    }
  }
}

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.dataset.view === 'post-preview') {
        checkThread(node);
      } else {
        for (const thread of
            node.querySelectorAll('[data-view=post-preview]')) {
          checkThread(thread);
        }
      }
    }
  }
});

observer.observe(document.body, {subtree: true, childList: true});