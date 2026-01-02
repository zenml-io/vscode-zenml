/**
 * Deployment Log Viewer - ZenML VS Code Extension
 * Webview runtime for displaying deployment logs
 */

(function () {
  'use strict';

  // Acquire VS Code API (only once)
  const vscode = acquireVsCodeApi();

  // DOM Elements
  const elements = {
    statusIndicator: document.getElementById('status-indicator'),
    deploymentTitle: document.getElementById('deployment-title'),
    timestamp: document.getElementById('timestamp'),
    refreshButton: document.getElementById('refresh-button'),
    autoScrollToggle: document.getElementById('auto-scroll-toggle'),
    logContainer: document.getElementById('log-container'),
    logContent: document.getElementById('log-content'),
    loadingState: document.getElementById('loading-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    emptyState: document.getElementById('empty-state'),
    logCount: document.getElementById('log-count'),
  };

  // State
  let state = {
    isLoading: false,
    autoScroll: true,
    logs: [],
    deploymentName: '',
    deploymentId: '',
    lastUpdated: null,
    error: null,
  };

  // Restore persisted state if available
  const previousState = vscode.getState();
  if (previousState) {
    state = { ...state, ...previousState };
    renderFromState();
  }

  /**
   * Initialize event listeners
   */
  function init() {
    // Refresh button click
    if (elements.refreshButton) {
      elements.refreshButton.addEventListener('click', handleRefresh);
    }

    // Auto-scroll toggle
    if (elements.autoScrollToggle) {
      elements.autoScrollToggle.checked = state.autoScroll;
      elements.autoScrollToggle.addEventListener('change', handleAutoScrollToggle);
    }

    // Scroll detection - disable auto-scroll if user scrolls up
    if (elements.logContainer) {
      elements.logContainer.addEventListener('scroll', handleScroll);
    }

    // Listen for messages from extension
    window.addEventListener('message', handleMessage);
  }

  /**
   * Handle refresh button click
   */
  function handleRefresh() {
    if (state.isLoading) return;

    vscode.postMessage({ command: 'refresh' });
  }

  /**
   * Handle auto-scroll toggle change
   */
  function handleAutoScrollToggle(event) {
    state.autoScroll = event.target.checked;
    persistState();

    if (state.autoScroll) {
      scrollToBottom();
    }
  }

  /**
   * Handle scroll events to detect manual scrolling
   */
  function handleScroll() {
    if (!elements.logContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = elements.logContainer;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    // If user scrolled away from bottom, disable auto-scroll
    if (!isAtBottom && state.autoScroll && !state.isLoading) {
      state.autoScroll = false;
      if (elements.autoScrollToggle) {
        elements.autoScrollToggle.checked = false;
      }
      persistState();
    }
  }

  /**
   * Handle messages from the extension
   */
  function handleMessage(event) {
    const message = event.data;

    switch (message.type) {
      case 'setLoading':
        setLoading(true);
        break;

      case 'setLogs':
        setLogs(message.payload);
        break;

      case 'setError':
        setError(message.payload);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Set loading state
   */
  function setLoading(isLoading) {
    state.isLoading = isLoading;
    state.error = null;

    // Update status indicator
    if (elements.statusIndicator) {
      elements.statusIndicator.classList.toggle('loading', isLoading);
      elements.statusIndicator.classList.remove('error');
    }

    // Update refresh button
    if (elements.refreshButton) {
      elements.refreshButton.disabled = isLoading;
      elements.refreshButton.classList.toggle('spinning', isLoading);
    }

    // Show/hide loading state (only if no logs yet)
    if (isLoading && state.logs.length === 0) {
      showState('loading');
    }

    persistState();
  }

  /**
   * Set logs data
   */
  function setLogs(payload) {
    state.isLoading = false;
    state.error = null;
    state.logs = payload.logs || [];
    state.deploymentName = payload.deploymentName || state.deploymentName;
    state.deploymentId = payload.deploymentId || state.deploymentId;
    state.lastUpdated = payload.timestamp || new Date().toISOString();

    // Update status indicator
    if (elements.statusIndicator) {
      elements.statusIndicator.classList.remove('loading', 'error');
    }

    // Update refresh button
    if (elements.refreshButton) {
      elements.refreshButton.disabled = false;
      elements.refreshButton.classList.remove('spinning');
    }

    // Render logs or empty state
    if (state.logs.length > 0) {
      renderLogs();
      showState('logs');
    } else {
      showState('empty');
    }

    // Update header info
    updateHeader();
    updateFooter();

    persistState();
  }

  /**
   * Set error state
   */
  function setError(payload) {
    state.isLoading = false;
    state.error = payload.message;

    // Update status indicator
    if (elements.statusIndicator) {
      elements.statusIndicator.classList.remove('loading');
      elements.statusIndicator.classList.add('error');
    }

    // Update refresh button
    if (elements.refreshButton) {
      elements.refreshButton.disabled = false;
      elements.refreshButton.classList.remove('spinning');
    }

    // Show error message
    if (elements.errorMessage) {
      elements.errorMessage.textContent = payload.message;
    }

    showState('error');
    persistState();
  }

  /**
   * Show a specific state (loading, logs, error, empty)
   */
  function showState(stateName) {
    const states = ['loading', 'error', 'empty', 'logs'];

    states.forEach(s => {
      const element = s === 'logs' ? elements.logContent : elements[s + 'State'];
      if (element) {
        element.classList.toggle('hidden', s !== stateName);
      }
    });
  }

  /**
   * Render logs to the container
   */
  function renderLogs() {
    if (!elements.logContent) return;

    // Clear existing content
    elements.logContent.innerHTML = '';

    // Create document fragment for performance
    const fragment = document.createDocumentFragment();

    state.logs.forEach((log, index) => {
      const line = createLogLine(index + 1, log);
      fragment.appendChild(line);
    });

    elements.logContent.appendChild(fragment);

    // Auto-scroll if enabled
    if (state.autoScroll) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }

  /**
   * Create a single log line element
   */
  function createLogLine(lineNumber, text) {
    const line = document.createElement('div');
    line.className = 'log-line';

    const numberEl = document.createElement('span');
    numberEl.className = 'log-line-number';
    numberEl.textContent = lineNumber;

    const textEl = document.createElement('span');
    textEl.className = 'log-line-text';
    // Use textContent to prevent XSS
    textEl.textContent = text;

    line.appendChild(numberEl);
    line.appendChild(textEl);

    return line;
  }

  /**
   * Update header information
   */
  function updateHeader() {
    if (elements.deploymentTitle && state.deploymentName) {
      elements.deploymentTitle.textContent = state.deploymentName;
    }

    if (elements.timestamp && state.lastUpdated) {
      const date = new Date(state.lastUpdated);
      elements.timestamp.textContent = 'Updated ' + formatTime(date);
    }
  }

  /**
   * Update footer information
   */
  function updateFooter() {
    if (elements.logCount) {
      const count = state.logs.length;
      elements.logCount.textContent = count + ' line' + (count !== 1 ? 's' : '');
    }
  }

  /**
   * Format time for display
   */
  function formatTime(date) {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * Scroll to bottom of log container
   */
  function scrollToBottom() {
    if (elements.logContainer) {
      elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
    }
  }

  /**
   * Persist state for restoration
   */
  function persistState() {
    vscode.setState({
      autoScroll: state.autoScroll,
      logs: state.logs,
      deploymentName: state.deploymentName,
      deploymentId: state.deploymentId,
      lastUpdated: state.lastUpdated,
    });
  }

  /**
   * Render from persisted state
   */
  function renderFromState() {
    if (elements.autoScrollToggle) {
      elements.autoScrollToggle.checked = state.autoScroll;
    }

    if (state.logs.length > 0) {
      renderLogs();
      showState('logs');
      updateHeader();
      updateFooter();
    } else if (state.error) {
      if (elements.errorMessage) {
        elements.errorMessage.textContent = state.error;
      }
      showState('error');
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
