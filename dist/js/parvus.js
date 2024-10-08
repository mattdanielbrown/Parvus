/**
 * Parvus
 *
 * @author Benjamin de Oostfrees
 * @version 3.0.0
 * @url https://github.com/deoostfrees/parvus
 *
 * MIT license
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Parvus = factory());
})(this, (function () { 'use strict';

  const FOCUSABLE_ELEMENTS = ['a:not([inert]):not([tabindex^="-"])', 'button:not([inert]):not([tabindex^="-"]):not(:disabled)', '[tabindex]:not([inert]):not([tabindex^="-"])'];

  /**
   * Get the focusable children of the given element
   *
   * @return {Array<Element>} - An array of focusable children
   */
  const getFocusableChildren = targetEl => {
    return Array.from(targetEl.querySelectorAll(FOCUSABLE_ELEMENTS.join(', '))).filter(child => child.offsetParent !== null);
  };

  const BROWSER_WINDOW = window;

  /**
   * Get scrollbar width
   *
   * @return {Number} - The scrollbar width
   */
  const getScrollbarWidth = () => {
    return BROWSER_WINDOW.innerWidth - document.documentElement.clientWidth;
  };

  /**
   * Add zoom indicator to element
   *
   * @param {HTMLElement} el - The element to add the zoom indicator to
   * @param {Object} config - Options object
   */
  const addZoomIndicator = (el, config) => {
    if (el.querySelector('img') && el.querySelector('.parvus-zoom__indicator') === null) {
      const LIGHTBOX_INDICATOR_ICON = document.createElement('div');
      LIGHTBOX_INDICATOR_ICON.className = 'parvus-zoom__indicator';
      LIGHTBOX_INDICATOR_ICON.innerHTML = config.lightboxIndicatorIcon;
      el.appendChild(LIGHTBOX_INDICATOR_ICON);
    }
  };

  /**
   * Remove zoom indicator for element
   *
   * @param {HTMLElement} el - The element to remove the zoom indicator to
   */
  const removeZoomIndicator = el => {
    if (el.querySelector('img') && el.querySelector('.parvus-zoom__indicator') !== null) {
      const LIGHTBOX_INDICATOR_ICON = el.querySelector('.parvus-zoom__indicator');
      el.removeChild(LIGHTBOX_INDICATOR_ICON);
    }
  };

  var en = {
    lightboxLabel: 'This is a dialog window that overlays the main content of the page. The modal displays the enlarged image. Pressing the Escape key will close the modal and bring you back to where you were on the page.',
    lightboxLoadingIndicatorLabel: 'Image loading',
    lightboxLoadingError: 'The requested image cannot be loaded.',
    controlsLabel: 'Controls',
    previousButtonLabel: 'Previous image',
    nextButtonLabel: 'Next image',
    closeButtonLabel: 'Close dialog window',
    sliderLabel: 'Images',
    slideLabel: 'Image'
  };

  function Parvus(userOptions) {
    /**
     * Global variables
     *
     */
    const BROWSER_WINDOW = window;
    const GROUP_ATTRIBUTES = {
      triggerElements: [],
      slider: null,
      sliderElements: [],
      contentElements: []
    };
    const GROUPS = {};
    let groupIdCounter = 0;
    let newGroup = null;
    let activeGroup = null;
    let currentIndex = 0;
    let config = {};
    let lightbox = null;
    let lightboxOverlay = null;
    let lightboxOverlayOpacity = 1;
    let toolbar = null;
    let toolbarLeft = null;
    let toolbarRight = null;
    let controls = null;
    let previousButton = null;
    let nextButton = null;
    let closeButton = null;
    let counter = null;
    let drag = {};
    let isDraggingX = false;
    let isDraggingY = false;
    let pointerDown = false;
    let offset = null;
    let offsetTmp = null;
    let resizeTicking = false;
    let isReducedMotion = true;

    /**
     * Merge default options with user-provided options
     *
     * @param {Object} userOptions - User-provided options
     * @returns {Object} - Merged options object
     */
    const mergeOptions = userOptions => {
      // Default options
      const DEFAULT_OPTIONS = {
        selector: '.lightbox',
        gallerySelector: null,
        zoomIndicator: true,
        captions: true,
        captionsSelector: 'self',
        captionsAttribute: 'data-caption',
        docClose: true,
        swipeClose: true,
        simulateTouch: true,
        threshold: 50,
        hideScrollbar: true,
        lightboxIndicatorIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" stroke="currentColor"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>',
        previousButtonIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" stroke="currentColor"><path stroke="none" d="M0 0h24v24H0z"/><polyline points="15 6 9 12 15 18" /></svg>',
        nextButtonIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" stroke="currentColor"><path stroke="none" d="M0 0h24v24H0z"/><polyline points="9 6 15 12 9 18" /></svg>',
        closeButtonIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" stroke="currentColor"><path d="M18 6L6 18M6 6l12 12"/></svg>',
        l10n: en
      };
      const MERGED_OPTIONS = {
        ...DEFAULT_OPTIONS,
        ...userOptions
      };
      if (userOptions && userOptions.l10n) {
        MERGED_OPTIONS.l10n = {
          ...DEFAULT_OPTIONS.l10n,
          ...userOptions.l10n
        };
      }
      return MERGED_OPTIONS;
    };

    /**
     * Check prefers reduced motion
     * https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList
     *
     */
    const MOTIONQUERY = BROWSER_WINDOW.matchMedia('(prefers-reduced-motion)');
    const reducedMotionCheck = () => {
      if (MOTIONQUERY.matches) {
        isReducedMotion = true;
      } else {
        isReducedMotion = false;
      }
    };

    /**
     * Get the group from element
     *
     * @param {HTMLElement} el - The element to retrieve the group from
     * @return {String} - The group of the element
     */
    const getGroup = el => {
      // Check if the data attribute "group" exists or set an alternative value
      const EL_GROUP = el.dataset.group || `default-${groupIdCounter}`;
      ++groupIdCounter;

      // Set the "group" data attribute if it doesn't exist
      if (!el.hasAttribute('data-group')) {
        el.setAttribute('data-group', EL_GROUP);
      }
      return EL_GROUP;
    };

    /**
     * Add an element
     *
     * @param {HTMLElement} el - The element to be added
     */
    const add = el => {
      // Check if the lightbox already exists
      if (!lightbox) {
        createLightbox();
      }
      if (!(el.tagName === 'A' && el.hasAttribute('href') || el.tagName === 'BUTTON' && el.hasAttribute('data-target'))) {
        throw new Error('Use a link with the \'href\' attribute or a button with the \'data-target\' attribute. Both attributes must contain a path to the image file.');
      }
      newGroup = getGroup(el);
      if (!GROUPS[newGroup]) {
        GROUPS[newGroup] = structuredClone(GROUP_ATTRIBUTES);
      }
      if (GROUPS[newGroup].triggerElements.includes(el)) {
        throw new Error('Ups, element already added.');
      }
      GROUPS[newGroup].triggerElements.push(el);
      if (config.zoomIndicator) {
        addZoomIndicator(el, config);
      }
      el.classList.add('parvus-trigger');
      el.addEventListener('click', triggerParvus);
      if (isOpen() && newGroup === activeGroup) {
        const EL_INDEX = GROUPS[newGroup].triggerElements.indexOf(el);
        createSlide(EL_INDEX);
        createImage(el, EL_INDEX, () => {
          loadImage(EL_INDEX);
        });
        updateAttributes();
        updateSliderNavigationStatus();
        updateCounter();
      }
    };

    /**
     * Remove an element
     *
     * @param {HTMLElement} el - The element to be removed
     */
    const remove = el => {
      if (!el || !el.hasAttribute('data-group')) {
        return;
      }
      const EL_GROUP = getGroup(el);

      // Check if element exists
      if (!GROUPS[EL_GROUP] || !GROUPS[EL_GROUP].triggerElements.includes(el)) {
        return;
      }
      const EL_INDEX = GROUPS[EL_GROUP].triggerElements.indexOf(el);
      GROUPS[EL_GROUP].triggerElements.splice(EL_INDEX, 1);
      GROUPS[EL_GROUP].sliderElements.splice(EL_INDEX, 1);
      if (config.zoomIndicator) {
        removeZoomIndicator(el);
      }
      if (isOpen() && EL_GROUP === activeGroup) {
        updateAttributes();
        updateSliderNavigationStatus();
        updateCounter();
      }

      // Unbind click event handler
      el.removeEventListener('click', triggerParvus);
      el.classList.remove('parvus-trigger');
    };

    /**
     * Create the lightbox
     *
     */
    const createLightbox = () => {
      // Create the lightbox container
      lightbox = document.createElement('dialog');
      lightbox.setAttribute('aria-label', config.l10n.lightboxLabel);
      lightbox.classList.add('parvus');

      // Create the lightbox overlay container
      lightboxOverlay = document.createElement('div');
      lightboxOverlay.classList.add('parvus__overlay');

      // Add the lightbox overlay container to the lightbox container
      lightbox.appendChild(lightboxOverlay);

      // Create the toolbar
      toolbar = document.createElement('div');
      toolbar.className = 'parvus__toolbar';

      // Create the toolbar items
      toolbarLeft = document.createElement('div');
      toolbarRight = document.createElement('div');

      // Create the controls
      controls = document.createElement('div');
      controls.className = 'parvus__controls';
      controls.setAttribute('role', 'group');
      controls.setAttribute('aria-label', config.l10n.controlsLabel);

      // Add the controls to the right toolbar item
      toolbarRight.appendChild(controls);

      // Create the close button
      closeButton = document.createElement('button');
      closeButton.className = 'parvus__btn parvus__btn--close';
      closeButton.setAttribute('type', 'button');
      closeButton.setAttribute('aria-label', config.l10n.closeButtonLabel);
      closeButton.innerHTML = config.closeButtonIcon;

      // Add the close button to the controls
      controls.appendChild(closeButton);

      // Create the previous button
      previousButton = document.createElement('button');
      previousButton.className = 'parvus__btn parvus__btn--previous';
      previousButton.setAttribute('type', 'button');
      previousButton.setAttribute('aria-label', config.l10n.previousButtonLabel);
      previousButton.innerHTML = config.previousButtonIcon;

      // Add the previous button to the controls
      controls.appendChild(previousButton);

      // Create the next button
      nextButton = document.createElement('button');
      nextButton.className = 'parvus__btn parvus__btn--next';
      nextButton.setAttribute('type', 'button');
      nextButton.setAttribute('aria-label', config.l10n.nextButtonLabel);
      nextButton.innerHTML = config.nextButtonIcon;

      // Add the next button to the controls
      controls.appendChild(nextButton);

      // Create the counter
      counter = document.createElement('div');
      counter.className = 'parvus__counter';

      // Add the counter to the left toolbar item
      toolbarLeft.appendChild(counter);

      // Add the toolbar items to the toolbar
      toolbar.appendChild(toolbarLeft);
      toolbar.appendChild(toolbarRight);

      // Add the toolbar to the lightbox container
      lightbox.appendChild(toolbar);

      // Add the lightbox container to the body
      document.body.appendChild(lightbox);
    };

    /**
     * Create a slider
     *
     */
    const createSlider = () => {
      const SLIDER = document.createElement('div');
      SLIDER.className = 'parvus__slider';

      // Hide the slider
      SLIDER.setAttribute('aria-hidden', 'true');

      // Update the slider reference in GROUPS
      GROUPS[activeGroup].slider = SLIDER;

      // Add the slider to the lightbox container
      lightbox.appendChild(SLIDER);
    };

    /**
     * Get next slide index
     *
     * @param {Number} index
     */
    const getNextSlideIndex = currentIndex => {
      const SLIDE_ELEMENTS = GROUPS[activeGroup].sliderElements;
      const TOTAL_SLIDE_ELEMENTS = SLIDE_ELEMENTS.length;
      for (let i = currentIndex + 1; i < TOTAL_SLIDE_ELEMENTS; i++) {
        if (SLIDE_ELEMENTS[i] !== undefined) {
          return i;
        }
      }
      return -1;
    };

    /**
     * Get previous slide index
     *
     * @param {number} index - The current slide index
     * @returns {number} - The index of the previous slide, or -1 if there is no previous slide
     */
    const getPreviousSlideIndex = currentIndex => {
      const SLIDE_ELEMENTS = GROUPS[activeGroup].sliderElements;
      for (let i = currentIndex - 1; i >= 0; i--) {
        if (SLIDE_ELEMENTS[i] !== undefined) {
          return i;
        }
      }
      return -1;
    };

    /**
     * Create a slide
     *
     * @param {Number} index - The index of the slide
     */
    const createSlide = index => {
      if (GROUPS[activeGroup].sliderElements[index] !== undefined) {
        return;
      }
      const SLIDER_ELEMENT = document.createElement('div');
      const SLIDER_ELEMENT_CONTENT = document.createElement('div');
      const TRIGGER_ELEMENTS = GROUPS[activeGroup].triggerElements;
      const TOTAL_TRIGGER_ELEMENTS = TRIGGER_ELEMENTS.length;
      SLIDER_ELEMENT.className = 'parvus__slide';
      SLIDER_ELEMENT.style.position = 'absolute';
      SLIDER_ELEMENT.style.left = `${index * 100}%`;
      SLIDER_ELEMENT.setAttribute('aria-hidden', 'true');
      SLIDER_ELEMENT.appendChild(SLIDER_ELEMENT_CONTENT);

      // Add extra output for screen reader if there is more than one slide
      if (TOTAL_TRIGGER_ELEMENTS > 1) {
        SLIDER_ELEMENT.setAttribute('role', 'group');
        SLIDER_ELEMENT.setAttribute('aria-label', `${config.l10n.slideLabel} ${index + 1}/${TOTAL_TRIGGER_ELEMENTS}`);
      }
      GROUPS[activeGroup].sliderElements[index] = SLIDER_ELEMENT;
      if (index >= currentIndex) {
        const NEXT_SLIDE_INDEX = getNextSlideIndex(index);
        if (NEXT_SLIDE_INDEX !== -1) {
          GROUPS[activeGroup].sliderElements[NEXT_SLIDE_INDEX].before(SLIDER_ELEMENT);
        } else {
          GROUPS[activeGroup].slider.appendChild(SLIDER_ELEMENT);
        }
      } else {
        const PREVIOUS_SLIDE_INDEX = getPreviousSlideIndex(index);
        if (PREVIOUS_SLIDE_INDEX !== -1) {
          GROUPS[activeGroup].sliderElements[PREVIOUS_SLIDE_INDEX].after(SLIDER_ELEMENT);
        } else {
          GROUPS[activeGroup].slider.prepend(SLIDER_ELEMENT);
        }
      }
    };

    /**
     * Open Parvus
     *
     * @param {HTMLElement} el
     */
    const open = el => {
      if (!lightbox || !el || !el.classList.contains('parvus-trigger') || isOpen()) {
        return;
      }
      activeGroup = getGroup(el);
      if (!GROUPS[activeGroup].triggerElements.includes(el)) {
        throw new Error('Ups, I can\'t find the element.');
      }
      currentIndex = GROUPS[activeGroup].triggerElements.indexOf(el);
      history.pushState({
        parvus: 'close'
      }, 'Image', window.location.href);
      bindEvents();
      if (config.hideScrollbar) {
        document.body.style.marginInlineEnd = `${getScrollbarWidth()}px`;
        document.body.style.overflow = 'hidden';
      }
      lightbox.classList.add('parvus--is-opening');
      lightbox.showModal();
      createSlider();
      createSlide(currentIndex);
      GROUPS[activeGroup].slider.setAttribute('aria-hidden', 'false');
      updateOffset();
      updateAttributes();
      updateSliderNavigationStatus();
      updateCounter();
      loadSlide(currentIndex);
      createImage(el, currentIndex, () => {
        loadImage(currentIndex, true);
        lightbox.classList.remove('parvus--is-opening');
        GROUPS[activeGroup].slider.classList.add('parvus__slider--animate');
      });
      preload(currentIndex + 1);
      preload(currentIndex - 1);

      // Create and dispatch a new event
      dispatchCustomEvent('open');
    };

    /**
     * Close Parvus
     *
     */
    const close = () => {
      if (!isOpen()) {
        throw new Error('Ups, I\'m already closed.');
      }
      const IMAGE = GROUPS[activeGroup].contentElements[currentIndex];
      const THUMBNAIL = GROUPS[activeGroup].triggerElements[currentIndex];
      unbindEvents();
      clearDrag();
      if (history.state?.parvus === 'close') {
        history.back();
      }
      lightbox.classList.add('parvus--is-closing');
      const transitionendHandler = () => {
        leaveSlide(currentIndex);
        lightbox.close();
        lightbox.classList.remove('parvus--is-closing');
        lightbox.classList.remove('parvus--is-vertical-closing');
        GROUPS[activeGroup].slider.remove();
        GROUPS[activeGroup].slider = null;
        GROUPS[activeGroup].sliderElements = [];
        GROUPS[activeGroup].contentElements = [];
        counter.removeAttribute('aria-hidden');
        previousButton.removeAttribute('aria-hidden');
        previousButton.removeAttribute('aria-disabled');
        nextButton.removeAttribute('aria-hidden');
        nextButton.removeAttribute('aria-disabled');
        if (config.hideScrollbar) {
          document.body.style.marginInlineEnd = '';
          document.body.style.overflow = '';
        }
      };
      if (IMAGE && IMAGE.tagName === 'IMG') {
        if (document.startViewTransition) {
          IMAGE.style.viewTransitionName = 'lightboximage';
          const transition = document.startViewTransition(() => {
            IMAGE.style.opacity = '0';
            IMAGE.style.viewTransitionName = null;
            THUMBNAIL.style.viewTransitionName = 'lightboximage';
          });
          transition.finished.finally(() => {
            transitionendHandler();
            THUMBNAIL.style.viewTransitionName = null;
          });
        } else {
          IMAGE.style.opacity = '0';
          transitionendHandler();
        }
      } else {
        transitionendHandler();
      }
    };

    /**
     * Preload slide with the specified index
     *
     * @param {Number} index - The index of the slide to be preloaded
     */
    const preload = index => {
      if (index < 0 || index >= GROUPS[activeGroup].triggerElements.length || GROUPS[activeGroup].sliderElements[index] !== undefined) {
        return;
      }
      createSlide(index);
      createImage(GROUPS[activeGroup].triggerElements[index], index, () => {
        loadImage(index);
      });
    };

    /**
     * Load slide with the specified index
     *
     * @param {Number} index - The index of the slide to be loaded
     */
    const loadSlide = index => {
      GROUPS[activeGroup].sliderElements[index].setAttribute('aria-hidden', 'false');
    };

    /**
     * Add caption to the container element
     *
     * @param {HTMLElement} containerEl - The container element to which the caption will be added
     * @param {HTMLElement} imageEl - The image the caption is linked to
     * @param {HTMLElement} el - The trigger element associated with the caption
     * @param {Number} index - The index of the caption
     */
    const addCaption = (containerEl, imageEl, el, index) => {
      const CAPTION_CONTAINER = document.createElement('div');
      let captionData = null;
      CAPTION_CONTAINER.className = 'parvus__caption';
      if (config.captionsSelector === 'self') {
        if (el.hasAttribute(config.captionsAttribute) && el.getAttribute(config.captionsAttribute) !== '') {
          captionData = el.getAttribute(config.captionsAttribute);
        }
      } else {
        const CAPTION_SELECTOR = el.querySelector(config.captionsSelector);
        if (CAPTION_SELECTOR !== null) {
          if (CAPTION_SELECTOR.hasAttribute(config.captionsAttribute) && CAPTION_SELECTOR.getAttribute(config.captionsAttribute) !== '') {
            captionData = CAPTION_SELECTOR.getAttribute(config.captionsAttribute);
          } else {
            captionData = CAPTION_SELECTOR.innerHTML;
          }
        }
      }
      if (captionData !== null) {
        const CAPTION_ID = `parvus__caption-${index}`;
        CAPTION_CONTAINER.id = CAPTION_ID;
        CAPTION_CONTAINER.innerHTML = `<p>${captionData}</p>`;
        containerEl.appendChild(CAPTION_CONTAINER);
        imageEl.setAttribute('aria-describedby', CAPTION_ID);
      }
    };
    const createImage = (el, index, callback) => {
      const {
        contentElements,
        sliderElements
      } = GROUPS[activeGroup];
      if (contentElements[index] !== undefined) {
        if (callback && typeof callback === 'function') {
          callback();
        }
        return;
      }
      const CONTENT_CONTAINER_EL = sliderElements[index].querySelector('div');
      const IMAGE = new Image();
      const IMAGE_CONTAINER = document.createElement('div');
      const THUMBNAIL = el.querySelector('img');
      const LOADING_INDICATOR = document.createElement('div');
      IMAGE_CONTAINER.className = 'parvus__content';

      // Create loading indicator
      LOADING_INDICATOR.className = 'parvus__loader';
      LOADING_INDICATOR.setAttribute('role', 'progressbar');
      LOADING_INDICATOR.setAttribute('aria-label', config.l10n.lightboxLoadingIndicatorLabel);

      // Add loading indicator to content container
      CONTENT_CONTAINER_EL.appendChild(LOADING_INDICATOR);
      const checkImagePromise = new Promise((resolve, reject) => {
        IMAGE.onload = () => resolve(IMAGE);
        IMAGE.onerror = error => reject(error);
      });
      checkImagePromise.then(loadedImage => {
        loadedImage.style.opacity = 0;
        IMAGE_CONTAINER.appendChild(loadedImage);
        CONTENT_CONTAINER_EL.appendChild(IMAGE_CONTAINER);

        // Add caption if available
        if (config.captions) {
          addCaption(CONTENT_CONTAINER_EL, IMAGE, el, index);
        }
        contentElements[index] = loadedImage;

        // Set image width and height
        loadedImage.setAttribute('width', loadedImage.naturalWidth);
        loadedImage.setAttribute('height', loadedImage.naturalHeight);

        // Set image dimension
        setImageDimension(sliderElements[index], loadedImage);
      }).catch(() => {
        const ERROR_CONTAINER = document.createElement('div');
        ERROR_CONTAINER.classList.add('parvus__content');
        ERROR_CONTAINER.classList.add('parvus__content--error');
        ERROR_CONTAINER.innerHTML = `${config.l10n.lightboxLoadingError}`;
        CONTENT_CONTAINER_EL.appendChild(ERROR_CONTAINER);
        contentElements[index] = ERROR_CONTAINER;
      }).finally(() => {
        CONTENT_CONTAINER_EL.removeChild(LOADING_INDICATOR);
        if (callback && typeof callback === 'function') {
          callback();
        }
      });

      // Add `sizes` attribute
      if (el.hasAttribute('data-sizes') && el.getAttribute('data-sizes') !== '') {
        IMAGE.setAttribute('sizes', el.getAttribute('data-sizes'));
      }

      // Add `srcset` attribute
      if (el.hasAttribute('data-srcset') && el.getAttribute('data-srcset') !== '') {
        IMAGE.setAttribute('srcset', el.getAttribute('data-srcset'));
      }

      // Add `src` attribute
      if (el.tagName === 'A') {
        IMAGE.setAttribute('src', el.href);
      } else {
        IMAGE.setAttribute('src', el.getAttribute('data-target'));
      }

      // `alt` attribute
      if (THUMBNAIL && THUMBNAIL.hasAttribute('alt') && THUMBNAIL.getAttribute('alt') !== '') {
        IMAGE.alt = THUMBNAIL.alt;
      } else if (el.hasAttribute('data-alt') && el.getAttribute('data-alt') !== '') {
        IMAGE.alt = el.getAttribute('data-alt');
      } else {
        IMAGE.alt = '';
      }
    };

    /**
     * Load Image
     *
     * @param {Number} index - The index of the image to load
     */
    const loadImage = (index, animate) => {
      const IMAGE = GROUPS[activeGroup].contentElements[index];
      if (IMAGE && IMAGE.tagName === 'IMG') {
        const THUMBNAIL = GROUPS[activeGroup].triggerElements[index];
        if (animate && document.startViewTransition) {
          THUMBNAIL.style.viewTransitionName = 'lightboximage';
          const transition = document.startViewTransition(() => {
            IMAGE.style.opacity = '';
            THUMBNAIL.style.viewTransitionName = null;
            IMAGE.style.viewTransitionName = 'lightboximage';
          });
          transition.finished.finally(() => {
            IMAGE.style.viewTransitionName = null;
          });
        } else {
          IMAGE.style.opacity = '';
        }
      } else {
        IMAGE.style.opacity = '';
      }
    };
    const select = index => {
      const OLD_INDEX = currentIndex;
      if (!isOpen()) {
        throw new Error("Oops, I'm closed.");
      } else {
        if (typeof index !== 'number' || isNaN(index)) {
          throw new Error('Oops, no slide specified.');
        }
        const triggerElements = GROUPS[activeGroup].triggerElements;
        if (index === currentIndex) {
          throw new Error(`Oops, slide ${index} is already selected.`);
        }
        if (index < -1 || index >= triggerElements.length) {
          throw new Error(`Oops, I can't find slide ${index}.`);
        }
      }
      if (GROUPS[activeGroup].sliderElements[index] !== undefined) {
        loadSlide(index);
      } else {
        createSlide(index);
        createImage(GROUPS[activeGroup].triggerElements[index], index, () => {
          loadImage(index);
        });
        loadSlide(index);
      }
      currentIndex = index;
      updateOffset();
      if (index < OLD_INDEX) {
        updateSliderNavigationStatus();
        preload(index - 1);
      } else if (index > OLD_INDEX) {
        updateSliderNavigationStatus();
        preload(index + 1);
      }
      leaveSlide(OLD_INDEX);
      updateCounter();

      // Create and dispatch a new event
      dispatchCustomEvent('select');
    };

    /**
     * Select the previous slide
     *
     */
    const previous = () => {
      if (currentIndex > 0) {
        select(currentIndex - 1);
      }
    };

    /**
     * Select the next slide
     *
     */
    const next = () => {
      const {
        triggerElements
      } = GROUPS[activeGroup];
      if (currentIndex < triggerElements.length - 1) {
        select(currentIndex + 1);
      }
    };

    /**
     * Leave slide
     *
     * This function is called after moving the index to a new slide.
     *
     * @param {Number} index - The index of the slide to leave.
     */
    const leaveSlide = index => {
      if (GROUPS[activeGroup].sliderElements[index] !== undefined) {
        GROUPS[activeGroup].sliderElements[index].setAttribute('aria-hidden', 'true');
      }
    };

    /**
     * Update offset
     *
     */
    const updateOffset = () => {
      activeGroup = activeGroup !== null ? activeGroup : newGroup;
      offset = -currentIndex * lightbox.offsetWidth;
      GROUPS[activeGroup].slider.style.transform = `translate3d(${offset}px, 0, 0)`;
      offsetTmp = offset;
    };

    /**
     * Update slider navigation status
     *
     * This function updates the disabled status of the slider navigation buttons
     * based on the current slide position.
     *
     */
    const updateSliderNavigationStatus = () => {
      const {
        triggerElements
      } = GROUPS[activeGroup];
      const TOTAL_TRIGGER_ELEMENTS = triggerElements.length;
      const FIRST_SLIDE = currentIndex === 0;
      const LAST_SLIDE = currentIndex === TOTAL_TRIGGER_ELEMENTS - 1;
      if (TOTAL_TRIGGER_ELEMENTS > 1) {
        if (FIRST_SLIDE) {
          previousButton.setAttribute('aria-disabled', 'true');
          nextButton.removeAttribute('aria-disabled');
        } else if (LAST_SLIDE) {
          previousButton.removeAttribute('aria-disabled');
          nextButton.setAttribute('aria-disabled', 'true');
        } else {
          previousButton.removeAttribute('aria-disabled');
          nextButton.removeAttribute('aria-disabled');
        }
      }
    };

    /**
     * Update counter
     *
     * This function updates the counter display based on the current slide index.
     */
    const updateCounter = () => {
      counter.textContent = `${currentIndex + 1}/${GROUPS[activeGroup].triggerElements.length}`;
    };

    /**
     * Clear drag after pointerup event
     *
     * This function clears the drag state after the pointerup event is triggered.
     */
    const clearDrag = () => {
      drag = {
        startX: 0,
        endX: 0,
        startY: 0,
        endY: 0
      };
    };

    /**
     * Recalculate drag/swipe event
     *
     */
    const updateAfterDrag = () => {
      const {
        startX,
        startY,
        endX,
        endY
      } = drag;
      const MOVEMENT_X = endX - startX;
      const MOVEMENT_Y = endY - startY;
      const MOVEMENT_X_DISTANCE = Math.abs(MOVEMENT_X);
      const MOVEMENT_Y_DISTANCE = Math.abs(MOVEMENT_Y);
      const {
        triggerElements
      } = GROUPS[activeGroup];
      const TOTAL_TRIGGER_ELEMENTS = triggerElements.length;
      if (isDraggingX) {
        if (MOVEMENT_X > 2 && MOVEMENT_X_DISTANCE >= config.threshold && currentIndex > 0) {
          previous();
        } else if (MOVEMENT_X < 2 && MOVEMENT_X_DISTANCE >= config.threshold && currentIndex !== TOTAL_TRIGGER_ELEMENTS - 1) {
          next();
        } else {
          updateOffset();
        }
      } else if (isDraggingY) {
        if (MOVEMENT_Y_DISTANCE > 2 && config.swipeClose && MOVEMENT_Y_DISTANCE >= config.threshold) {
          close();
        } else {
          lightbox.classList.remove('parvus--is-vertical-closing');
          updateOffset();
        }
        lightboxOverlay.style.opacity = '';
      } else {
        updateOffset();
      }
    };

    /**
     * Update Attributes
     *
     */
    const updateAttributes = () => {
      const TRIGGER_ELEMENTS = GROUPS[activeGroup].triggerElements;
      const TOTAL_TRIGGER_ELEMENTS = TRIGGER_ELEMENTS.length;
      const SLIDER = GROUPS[activeGroup].slider;
      const SLIDER_ELEMENTS = GROUPS[activeGroup].sliderElements;
      const IS_DRAGGABLE = SLIDER.classList.contains('parvus__slider--is-draggable');

      // Add draggable class if neccesary
      if (config.simulateTouch && config.swipeClose && !IS_DRAGGABLE || config.simulateTouch && TOTAL_TRIGGER_ELEMENTS > 1 && !IS_DRAGGABLE) {
        SLIDER.classList.add('parvus__slider--is-draggable');
      } else {
        SLIDER.classList.remove('parvus__slider--is-draggable');
      }

      // Add extra output for screen reader if there is more than one slide
      if (TOTAL_TRIGGER_ELEMENTS > 1) {
        SLIDER.setAttribute('role', 'region');
        SLIDER.setAttribute('aria-roledescription', 'carousel');
        SLIDER.setAttribute('aria-label', config.l10n.sliderLabel);
        SLIDER_ELEMENTS.forEach((sliderElement, index) => {
          sliderElement.setAttribute('role', 'group');
          sliderElement.setAttribute('aria-label', `${config.l10n.slideLabel} ${index + 1}/${TOTAL_TRIGGER_ELEMENTS}`);
        });
      } else {
        SLIDER.removeAttribute('role');
        SLIDER.removeAttribute('aria-roledescription');
        SLIDER.removeAttribute('aria-label');
        SLIDER_ELEMENTS.forEach(sliderElement => {
          sliderElement.removeAttribute('role');
          sliderElement.removeAttribute('aria-label');
        });
      }

      // Show or hide buttons
      if (TOTAL_TRIGGER_ELEMENTS === 1) {
        counter.setAttribute('aria-hidden', 'true');
        previousButton.setAttribute('aria-hidden', 'true');
        nextButton.setAttribute('aria-hidden', 'true');
      } else {
        counter.removeAttribute('aria-hidden');
        previousButton.removeAttribute('aria-hidden');
        nextButton.removeAttribute('aria-hidden');
      }
    };

    /**
     * Resize event handler
     *
     */
    const resizeHandler = () => {
      if (!resizeTicking) {
        resizeTicking = true;
        BROWSER_WINDOW.requestAnimationFrame(() => {
          GROUPS[activeGroup].sliderElements.forEach((slide, index) => {
            setImageDimension(slide, GROUPS[activeGroup].contentElements[index]);
          });
          updateOffset();
          resizeTicking = false;
        });
      }
    };

    /**
     * Set image dimension
     *
     * @param {HTMLElement} slideEl - The slide element
     * @param {HTMLElement} contentEl - The content element
     */
    const setImageDimension = (slideEl, contentEl) => {
      if (contentEl.tagName !== 'IMG') {
        return;
      }
      const SLIDE_EL_STYLES = getComputedStyle(slideEl);
      const CAPTION_EL = slideEl.querySelector('.parvus__caption');
      const CAPTION_REC = CAPTION_EL ? CAPTION_EL.getBoundingClientRect().height : 0;
      const SRC_HEIGHT = contentEl.getAttribute('height');
      const SRC_WIDTH = contentEl.getAttribute('width');
      let maxHeight = slideEl.offsetHeight;
      let maxWidth = slideEl.offsetWidth;
      maxHeight -= parseFloat(SLIDE_EL_STYLES.paddingTop) + parseFloat(SLIDE_EL_STYLES.paddingBottom) + parseFloat(CAPTION_REC);
      maxWidth -= parseFloat(SLIDE_EL_STYLES.paddingLeft) + parseFloat(SLIDE_EL_STYLES.paddingRight);
      const RATIO = Math.min(maxWidth / SRC_WIDTH || 0, maxHeight / SRC_HEIGHT);
      const NEW_WIDTH = SRC_WIDTH * RATIO || 0;
      const NEW_HEIGHT = SRC_HEIGHT * RATIO || 0;
      if (SRC_HEIGHT > NEW_HEIGHT && SRC_HEIGHT < maxHeight && SRC_WIDTH > NEW_WIDTH && SRC_WIDTH < maxWidth || SRC_HEIGHT < NEW_HEIGHT && SRC_HEIGHT < maxHeight && SRC_WIDTH < NEW_WIDTH && SRC_WIDTH < maxWidth) {
        contentEl.style.width = '';
        contentEl.style.height = '';
      } else {
        contentEl.style.width = `${NEW_WIDTH}px`;
        contentEl.style.height = `${NEW_HEIGHT}px`;
      }
    };

    /**
     * Click event handler to trigger Parvus
     *
     * @param {Event} event - The click event object
     */
    const triggerParvus = function triggerParvus(event) {
      event.preventDefault();
      open(this);
    };

    /**
     * Event handler for click events
     *
     * @param {Event} event - The click event object
     */
    const clickHandler = event => {
      const {
        target
      } = event;
      if (target === previousButton) {
        previous();
      } else if (target === nextButton) {
        next();
      } else if (target === closeButton || config.docClose && !isDraggingY && !isDraggingX && target.classList.contains('parvus__slide')) {
        close();
      }
      event.stopPropagation();
    };

    /**
     * Event handler for the keydown event
     *
     * @param {Event} event - The keydown event object
     */
    const keydownHandler = event => {
      const FOCUSABLE_CHILDREN = getFocusableChildren(lightbox);
      const FOCUSED_ITEM_INDEX = FOCUSABLE_CHILDREN.indexOf(document.activeElement);
      const lastIndex = FOCUSABLE_CHILDREN.length - 1;
      switch (event.code) {
        case 'Tab':
          {
            // Use the TAB key to navigate backwards and forwards
            if (event.shiftKey) {
              // Navigate backwards
              if (FOCUSED_ITEM_INDEX === 0) {
                FOCUSABLE_CHILDREN[lastIndex].focus();
                event.preventDefault();
              }
            } else {
              // Navigate forwards
              if (FOCUSED_ITEM_INDEX === lastIndex) {
                FOCUSABLE_CHILDREN[0].focus();
                event.preventDefault();
              }
            }
            break;
          }
        case 'Escape':
          {
            // Close Parvus when the ESC key is pressed
            close();
            event.preventDefault();
            break;
          }
        case 'ArrowLeft':
          {
            // Show the previous slide when the PREV key is pressed
            previous();
            event.preventDefault();
            break;
          }
        case 'ArrowRight':
          {
            // Show the next slide when the NEXT key is pressed
            next();
            event.preventDefault();
            break;
          }
      }
    };

    /**
     * Event handler for the pointerdown event.
     *
     * This function is triggered when a pointer becomes active buttons state.
     * It handles the necessary actions and logic related to the pointerdown event.
     *
     * @param {Event} event - The pointerdown event object
     */
    const pointerdownHandler = event => {
      event.preventDefault();
      event.stopPropagation();
      if (event.pointerType === 'mouse' && !config.simulateTouch) {
        return;
      }
      isDraggingX = false;
      isDraggingY = false;
      pointerDown = true;
      const {
        pageX,
        pageY
      } = event;
      drag.startX = pageX;
      drag.startY = pageY;
      const {
        slider
      } = GROUPS[activeGroup];
      slider.classList.add('parvus__slider--is-dragging');
      slider.style.willChange = 'transform';
      lightboxOverlayOpacity = getComputedStyle(lightboxOverlay).opacity;
    };

    /**
     * Event handler for the pointermove event.
     *
     * This function is triggered when a pointer changes coordinates.
     * It handles the necessary actions and logic related to the pointermove event.
     *
     * @param {Event} event - The pointermove event object
     */
    const pointermoveHandler = event => {
      event.preventDefault();
      if (pointerDown) {
        const {
          pageX,
          pageY
        } = event;
        drag.endX = pageX;
        drag.endY = pageY;
        doSwipe();
      }
    };

    /**
     * Event handler for the pointerup event.
     *
     * This function is triggered when a pointer is no longer active buttons state.
     * It handles the necessary actions and logic related to the pointerup event.
     *
     * @param {Event} event - The pointerup event object
     */
    const pointerupHandler = event => {
      event.stopPropagation();
      pointerDown = false;
      const {
        slider
      } = GROUPS[activeGroup];
      slider.classList.remove('parvus__slider--is-dragging');
      slider.style.willChange = '';
      if (drag.endX || drag.endY) {
        updateAfterDrag();
      }
      clearDrag();
    };

    /**
     * Determine the swipe direction (horizontal or vertical).
     *
     * This function analyzes the swipe gesture and decides whether it is a horizontal
     * or vertical swipe based on the direction and angle of the swipe.
     */
    const doSwipe = () => {
      const {
        startX,
        endX,
        startY,
        endY
      } = drag;
      const MOVEMENT_X = startX - endX;
      const MOVEMENT_Y = endY - startY;
      const MOVEMENT_Y_DISTANCE = Math.abs(MOVEMENT_Y);
      if (Math.abs(MOVEMENT_X) > 2 && !isDraggingY && GROUPS[activeGroup].triggerElements.length > 1) {
        // Horizontal swipe
        GROUPS[activeGroup].slider.style.transform = `translate3d(${offsetTmp - Math.round(MOVEMENT_X)}px, 0, 0)`;
        isDraggingX = true;
        isDraggingY = false;
      } else if (Math.abs(MOVEMENT_Y) > 2 && !isDraggingX && config.swipeClose) {
        // Vertical swipe
        if (!isReducedMotion && MOVEMENT_Y_DISTANCE <= 100) {
          lightboxOverlay.style.opacity = lightboxOverlayOpacity - MOVEMENT_Y_DISTANCE / 100;
        }
        lightbox.classList.add('parvus--is-vertical-closing');
        GROUPS[activeGroup].slider.style.transform = `translate3d(${offsetTmp}px, ${Math.round(MOVEMENT_Y)}px, 0)`;
        isDraggingX = false;
        isDraggingY = true;
      }
    };

    /**
     * Bind specified events
     *
     */
    const bindEvents = () => {
      BROWSER_WINDOW.addEventListener('keydown', keydownHandler);
      BROWSER_WINDOW.addEventListener('resize', resizeHandler);

      // Popstate event
      BROWSER_WINDOW.addEventListener('popstate', close);

      // Check for any OS level changes to the prefers reduced motion preference
      MOTIONQUERY.addEventListener('change', reducedMotionCheck);

      // Click event
      lightbox.addEventListener('click', clickHandler);

      // Pointer events
      lightbox.addEventListener('pointerdown', pointerdownHandler);
      lightbox.addEventListener('pointerup', pointerupHandler);
      lightbox.addEventListener('pointermove', pointermoveHandler);
    };

    /**
     * Unbind specified events
     *
     */
    const unbindEvents = () => {
      BROWSER_WINDOW.removeEventListener('keydown', keydownHandler);
      BROWSER_WINDOW.removeEventListener('resize', resizeHandler);

      // Popstate event
      BROWSER_WINDOW.removeEventListener('popstate', close);

      // Check for any OS level changes to the prefers reduced motion preference
      MOTIONQUERY.removeEventListener('change', reducedMotionCheck);

      // Click event
      lightbox.removeEventListener('click', clickHandler);

      // Pointer events
      lightbox.removeEventListener('pointerdown', pointerdownHandler);
      lightbox.removeEventListener('pointerup', pointerupHandler);
      lightbox.removeEventListener('pointermove', pointermoveHandler);
    };

    /**
     * Destroy Parvus
     *
     */
    const destroy = () => {
      if (!lightbox) {
        return;
      }
      if (isOpen()) {
        close();
      }
      lightbox.remove();
      const LIGHTBOX_TRIGGER_ELS = document.querySelectorAll('.parvus-trigger');
      LIGHTBOX_TRIGGER_ELS.forEach(remove);

      // Create and dispatch a new event
      dispatchCustomEvent('destroy');
    };

    /**
     * Check if Parvus is open
     *
     * @returns {boolean} - True if Parvus is open, otherwise false
     */
    const isOpen = () => {
      return lightbox.hasAttribute('open');
    };

    /**
     * Get the current index
     *
     * @returns {number} - The current index
     */
    const getCurrentIndex = () => {
      return currentIndex;
    };

    /**
     * Dispatch a custom event
     *
     * @param {String} type - The type of the event to dispatch
     */
    const dispatchCustomEvent = type => {
      const CUSTOM_EVENT = new CustomEvent(type, {
        cancelable: true
      });
      lightbox.dispatchEvent(CUSTOM_EVENT);
    };

    /**
     * Bind a specific event listener
     *
     * @param {String} eventName - The name of the event to Bind
     * @param {Function} callback - The callback function
     */
    const on = (eventName, callback) => {
      if (lightbox) {
        lightbox.addEventListener(eventName, callback);
      }
    };

    /**
     * Unbind a specific event listener
     *
     * @param {String} eventName - The name of the event to unbind
     * @param {Function} callback - The callback function
     */
    const off = (eventName, callback) => {
      if (lightbox) {
        lightbox.removeEventListener(eventName, callback);
      }
    };

    /**
     * Init
     *
     */
    const init = () => {
      // Merge user options into defaults
      config = mergeOptions(userOptions);
      reducedMotionCheck();
      if (config.gallerySelector !== null) {
        // Get a list of all `gallerySelector` elements within the document
        const GALLERY_ELS = document.querySelectorAll(config.gallerySelector);

        // Execute a few things once per element
        GALLERY_ELS.forEach((galleryEl, index) => {
          const GALLERY_INDEX = index;
          // Get a list of all `selector` elements within the `gallerySelector`
          const LIGHTBOX_TRIGGER_GALLERY_ELS = galleryEl.querySelectorAll(config.selector);

          // Execute a few things once per element
          LIGHTBOX_TRIGGER_GALLERY_ELS.forEach(lightboxTriggerEl => {
            lightboxTriggerEl.setAttribute('data-group', `parvus-gallery-${GALLERY_INDEX}`);
            add(lightboxTriggerEl);
          });
        });
      }

      // Get a list of all `selector` elements outside or without the `gallerySelector`
      const LIGHTBOX_TRIGGER_ELS = document.querySelectorAll(`${config.selector}:not(.parvus-trigger)`);
      LIGHTBOX_TRIGGER_ELS.forEach(add);
    };
    init();
    return {
      init,
      open,
      close,
      select,
      previous,
      next,
      currentIndex: getCurrentIndex,
      add,
      remove,
      destroy,
      isOpen,
      on,
      off
    };
  }

  return Parvus;

}));
