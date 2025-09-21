// Forms Controller Class
class FormsController {
  constructor() {
    this.currentBlock = null;
    this.fields = new Map();
    this.lovs = new Map();
    this.isDirty = false;
    this.isNew = false;
    this.queryMode = false;
    
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    window.addEventListener('beforeunload', (e) => {
      if (this.isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    });
  }

  registerField(fieldName, element, options = {}) {
    this.fields.set(fieldName, {
      element: element,
      required: options.required || false,
      dataType: options.dataType || 'string',
      maxLength: options.maxLength,
      lovId: options.lovId,
      defaultValue: options.defaultValue,
      validation: options.validation
    });

    element.addEventListener('change', () => {
      this.isDirty = true;
      this.validateField(fieldName);
    });
  }

  registerLOV(lovId, config) {
    this.lovs.set(lovId, {
      url: config.url,
      columns: config.columns,
      returnItems: config.returnItems,
      filterFields: config.filterFields
    });
  }

  async showLOV(lovId) {
    const lov = this.lovs.get(lovId);
    if (!lov) return;

    const modal = document.createElement('div');
    modal.className = 'lov-modal';
    
    try {
      const response = await fetch(lov.url);
      const data = await response.json();
      
      // Create LOV grid
      const grid = this.createLOVGrid(data, lov.columns);
      modal.appendChild(grid);
      
      document.body.appendChild(modal);
    } catch (error) {
      this.showError('Error loading LOV data');
    }
  }

  handleKeyPress(event) {
    switch(event.key) {
      case 'Tab':
        this.navigateNext();
        break;
      case 'Enter':
        this.navigateNext();
        break;
      case 'F7':
        if (!event.ctrlKey) {
          event.preventDefault();
          this.enterQuery();
        }
        break;
      case 'F8':
        if (!event.ctrlKey) {
          event.preventDefault();
          this.executeQuery();
        }
        break;
      case 'F10':
        if (!event.ctrlKey) {
          event.preventDefault();
          this.save();
        }
        break;
    }
  }

  navigateNext() {
    const focusableElements = Array.from(document.querySelectorAll('input:not([disabled]), select:not([disabled])'));
    const currentIndex = focusableElements.indexOf(document.activeElement);
    const nextElement = focusableElements[currentIndex + 1] || focusableElements[0];
    nextElement.focus();
  }

  validateField(fieldName) {
    const field = this.fields.get(fieldName);
    if (!field) return true;

    const value = field.element.value;
    let isValid = true;
    let errorMessage = '';

    // Required field validation
    if (field.required && !value) {
      isValid = false;
      errorMessage = 'This field is required';
    }

    // Data type validation
    if (value && field.dataType) {
      switch(field.dataType) {
        case 'number':
          if (isNaN(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid number';
          }
          break;
        case 'date':
          if (!Date.parse(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid date';
          }
          break;
      }
    }

    // Custom validation
    if (field.validation && typeof field.validation === 'function') {
      const customValidation = field.validation(value);
      if (customValidation !== true) {
        isValid = false;
        errorMessage = customValidation;
      }
    }

    this.setFieldError(field.element, errorMessage);
    return isValid;
  }

  setFieldError(element, errorMessage) {
    const errorDiv = element.nextElementSibling?.classList.contains('error-message') 
      ? element.nextElementSibling 
      : document.createElement('div');
    
    errorDiv.className = 'error-message';
    errorDiv.textContent = errorMessage;
    
    if (!element.nextElementSibling?.classList.contains('error-message')) {
      element.parentNode.insertBefore(errorDiv, element.nextSibling);
    }
    
    element.classList.toggle('error', !!errorMessage);
  }

  validateForm() {
    let isValid = true;
    this.fields.forEach((field, fieldName) => {
      if (!this.validateField(fieldName)) {
        isValid = false;
      }
    });
    return isValid;
  }

  async save() {
    if (!this.validateForm()) {
      this.showError('Please correct the errors before saving');
      return;
    }

    const formData = {};
    this.fields.forEach((field, fieldName) => {
      formData[fieldName] = field.element.value;
    });

    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Save failed');

      this.isDirty = false;
      this.showMessage('Record saved successfully');
    } catch (error) {
      this.showError('Error saving record: ' + error.message);
    }
  }

  async executeQuery() {
    if (!this.queryMode) return;

    const queryParams = {};
    this.fields.forEach((field, fieldName) => {
      if (field.element.value) {
        queryParams[fieldName] = field.element.value;
      }
    });

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(queryParams)
      });

      const data = await response.json();
      this.populateForm(data);
      this.queryMode = false;
    } catch (error) {
      this.showError('Error executing query: ' + error.message);
    }
  }

  enterQuery() {
    this.queryMode = true;
    this.clearForm();
    this.showMessage('Enter query mode');
  }

  clearForm() {
    this.fields.forEach(field => {
      field.element.value = '';
      this.setFieldError(field.element, '');
    });
    this.isDirty = false;
  }

  populateForm(data) {
    this.fields.forEach((field, fieldName) => {
      if (data.hasOwnProperty(fieldName)) {
        field.element.value = data[fieldName];
      }
    });
    this.isDirty = false;
  }

  showMessage(message) {
    const messageDiv = document.getElementById('message-container') || this.createMessageContainer();
    messageDiv.textContent = message;
    messageDiv.className = 'message-success';
    setTimeout(() => messageDiv.textContent = '', 3000);
  }

  showError(message) {
    const messageDiv = document.getElementById('message-container') || this.createMessageContainer();
    messageDiv.textContent = message;
    messageDiv.className = 'message-error';
  }

  createMessageContainer() {
    const div = document.createElement('div');
    div.id = 'message-container';
    document.body.appendChild(div);
    return div;
  }

  createLOVGrid(data, columns) {
    const table = document.createElement('table');
    table.className = 'lov-grid';

    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    columns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.header;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body
    const tbody = document.createElement('tbody');
    data.forEach(row => {
      const tr = document.createElement('tr');
      columns.forEach(col => {
        const td = document.createElement('td');
        td.textContent = row[col.field];
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
  }
}

// Initialize controller
const formsController = new FormsController();