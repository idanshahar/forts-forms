// Forms Controller Class
class FormsController {
  constructor() {
    this.fields = new Map();
    this.currentField = null;
    this.queryMode = false;
    this.lovWindows = new Map();
    this.dirtyFields = new Set();
    
    this.initializeKeyHandlers();
    this.initializeFields();
  }

  initializeKeyHandlers() {
    document.addEventListener('keydown', (e) => {
      switch(e.key) {
        case 'Tab':
          e.preventDefault();
          this.navigateNext();
          break;
        case 'Enter':
          e.preventDefault(); 
          this.navigateNext();
          break;
        case 'F7':
          e.preventDefault();
          this.enterQuery();
          break;
        case 'F8':
          e.preventDefault();
          this.executeQuery();
          break;
        case 'F10':
          e.preventDefault();
          this.save();
          break;
      }
    });
  }

  initializeFields() {
    document.querySelectorAll('input, select, textarea').forEach(el => {
      const field = new FormField(el);
      this.fields.set(el.id, field);
      
      el.addEventListener('focus', () => {
        this.currentField = field;
      });
      
      el.addEventListener('change', () => {
        this.dirtyFields.add(field);
        this.validateField(field);
      });
    });
  }

  validateField(field) {
    if(field.required && !field.value) {
      this.showError(`${field.label} is required`);
      return false;
    }
    return field.validate();
  }

  validateForm() {
    let isValid = true;
    this.fields.forEach(field => {
      if(!this.validateField(field)) {
        isValid = false;
      }
    });
    return isValid;
  }

  navigateNext() {
    const fields = Array.from(this.fields.values());
    const currentIndex = fields.indexOf(this.currentField);
    const nextField = fields[currentIndex + 1] || fields[0];
    nextField.element.focus();
  }

  enterQuery() {
    this.queryMode = true;
    this.clearAllFields();
    document.body.classList.add('query-mode');
  }

  executeQuery() {
    if(!this.queryMode) return;
    
    const queryParams = {};
    this.fields.forEach((field, key) => {
      if(field.value) {
        queryParams[key] = field.value;
      }
    });

    this.fetchRecords(queryParams)
      .then(records => this.displayRecords(records))
      .catch(err => this.showError(err));
      
    this.queryMode = false;
    document.body.classList.remove('query-mode');
  }

  async fetchRecords(params) {
    const response = await fetch('/api/records', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    
    if(!response.ok) {
      throw new Error('Query failed');
    }
    
    return response.json();
  }

  displayRecords(records) {
    if(records.length === 0) {
      this.showMessage('No records found');
      return;
    }
    
    // Display first record
    const record = records[0];
    this.fields.forEach((field, key) => {
      field.value = record[key] || '';
    });
  }

  async save() {
    if(!this.validateForm()) return;
    
    if(this.dirtyFields.size === 0) {
      this.showMessage('No changes to save');
      return;
    }

    const data = {};
    this.dirtyFields.forEach(field => {
      data[field.name] = field.value;
    });

    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if(!response.ok) throw new Error('Save failed');
      
      this.showMessage('Record saved successfully');
      this.dirtyFields.clear();
    } catch(err) {
      this.showError(err);
    }
  }

  showLov(field) {
    if(this.lovWindows.has(field.name)) {
      return;
    }

    const lovWindow = new LovWindow(field);
    this.lovWindows.set(field.name, lovWindow);
    
    lovWindow.onSelect = (value) => {
      field.value = value;
      this.lovWindows.delete(field.name);
      field.element.focus();
    };
  }

  clearAllFields() {
    this.fields.forEach(field => field.clear());
    this.dirtyFields.clear();
  }

  showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 3000);
  }

  showMessage(message) {
    const messageDiv = document.getElementById('info-message');
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
  }
}

class FormField {
  constructor(element) {
    this.element = element;
    this.name = element.id;
    this.label = element.getAttribute('data-label') || this.name;
    this.required = element.hasAttribute('required');
    this.validators = [];
    
    if(element.getAttribute('data-lov')) {
      this.initializeLov();
    }
  }

  get value() {
    return this.element.value;
  }

  set value(val) {
    this.element.value = val;
  }

  clear() {
    this.value = '';
  }

  validate() {
    return this.validators.every(validator => validator(this.value));
  }

  initializeLov() {
    const lovButton = document.createElement('button');
    lovButton.className = 'lov-button';
    lovButton.innerHTML = '...';
    this.element.parentNode.insertBefore(lovButton, this.element.nextSibling);
    
    lovButton.addEventListener('click', () => {
      formsController.showLov(this);
    });
  }
}

class LovWindow {
  constructor(field) {
    this.field = field;
    this.window = null;
    this.onSelect = null;
    this.create();
  }

  create() {
    this.window = document.createElement('div');
    this.window.className = 'lov-window';
    
    const header = document.createElement('div');
    header.className = 'lov-header';
    header.innerHTML = `List of Values - ${this.field.label}`;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = 'X';
    closeBtn.onclick = () => this.close();
    header.appendChild(closeBtn);
    
    const content = document.createElement('div');
    content.className = 'lov-content';
    
    this.window.appendChild(header);
    this.window.appendChild(content);
    document.body.appendChild(this.window);
    
    this.loadData();
  }

  async loadData() {
    try {
      const response = await fetch(`/api/lov/${this.field.name}`);
      const data = await response.json();
      this.displayData(data);
    } catch(err) {
      console.error('Failed to load LOV data:', err);
    }
  }

  displayData(data) {
    const content = this.window.querySelector('.lov-content');
    const table = document.createElement('table');
    
    data.forEach(row => {
      const tr = document.createElement('tr');
      tr.onclick = () => {
        if(this.onSelect) {
          this.onSelect(row.value);
        }
        this.close();
      };
      
      Object.values(row).forEach(value => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });
      
      table.appendChild(tr);
    });
    
    content.appendChild(table);
  }

  close() {
    document.body.removeChild(this.window);
  }
}

// Initialize controller when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.formsController = new FormsController();
});