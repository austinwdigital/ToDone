import * as vscode from "vscode";
import { debounce } from './utils';

interface TodoItem {
  filePath: string;
  line: number;
  text: string;
}

// Simplified tree item creation functions
const createFileItem = (filePath: string, todoCount: number): vscode.TreeItem => {
  const item = new vscode.TreeItem('');
  item.resourceUri = vscode.Uri.file(filePath);
  item.label = `${filePath.split(/[/\\]/).pop()} (${todoCount})`;
  item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
  return item;
};

const createPathItem = (filePath: string): vscode.TreeItem => {
  const item = new vscode.TreeItem('');
  const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
  item.label = filePath.replace(workspacePath, '').replace(/^[/\\]/, '');
  return item;
};

const createTodoItem = (todo: TodoItem): vscode.TreeItem => {
  const item = new vscode.TreeItem(todo.text);
  item.description = `${todo.line}`;
  item.iconPath = new vscode.ThemeIcon('circle-small-filled');
  item.command = {
    title: "Open File",
    command: "todoTree.openFile",
    arguments: [todo],
  };
  return item;
};

export class TodoTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private todos = new Map<string, TodoItem>();
  private fileItemCache = new Map<string, vscode.TreeItem>();
  private emitter = new vscode.EventEmitter<undefined | string>();
  private view?: vscode.TreeView<vscode.TreeItem>;
  readonly onDidChangeTreeData = this.emitter.event;

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (!element) {
      return this.getRootItems();
    }
    return this.getFileItems(element);
  }

  private getRootItems(): Promise<vscode.TreeItem[]> {
    const fileGroups = this.groupTodosByFile();
    return Promise.resolve(
      Array.from(fileGroups.entries())
        .map(([filePath, todos]) => this.getCachedFileItem(filePath, todos.length))
        .sort((a, b) => (a.label as string).localeCompare(b.label as string))
    );
  }

  private getFileItems(element: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    const filePath = (element.resourceUri as vscode.Uri).fsPath;
    const fileTodos = this.getTodosForFile(filePath);
    return Promise.resolve([
      createPathItem(filePath),
      ...fileTodos.map(createTodoItem)
    ]);
  }

  private groupTodosByFile(): Map<string, TodoItem[]> {
    const fileGroups = new Map<string, TodoItem[]>();
    for (const todo of this.todos.values()) {
      const items = fileGroups.get(todo.filePath) || [];
      items.push(todo);
      fileGroups.set(todo.filePath, items);
    }
    return fileGroups;
  }

  private getCachedFileItem(filePath: string, todoCount: number): vscode.TreeItem {
    const cacheKey = `${filePath}:${todoCount}`;
    if (!this.fileItemCache.has(cacheKey)) {
      this.fileItemCache.set(cacheKey, createFileItem(filePath, todoCount));
    }
    return this.fileItemCache.get(cacheKey)!;
  }

  private getTodosForFile(filePath: string): TodoItem[] {
    return Array.from(this.todos.values())
      .filter(todo => todo.filePath === filePath)
      .sort((a, b) => a.line - b.line);
  }

  addTodosForFile(filePath: string, fileContent: string): void {
    // Clear existing todos for this file
    Array.from(this.todos.keys())
      .filter(key => key.startsWith(filePath))
      .forEach(key => this.todos.delete(key));

    // Find new todos
    const regex = /(?:\/\/|#)\s*(?:todos?|fixme)(?:[:\s-]+)(.+)/i;
    fileContent.split('\n').forEach((line, index) => {
      const match = regex.exec(line);
      if (match) {
        const key = `${filePath}:${index + 1}`;
        this.todos.set(key, {
          filePath,
          line: index + 1,
          text: match[1].trim(),
        });
      }
    });

    this.emitter.fire(undefined);
  }

  getTotalTodos = () => this.todos.size;

  updateBadge(): void {
    const view = vscode.window.createTreeView('todoTreeView', { 
      treeDataProvider: this,
      showCollapseAll: true
    });
    view.badge = {
      tooltip: `${this.todos.size} TODOs`,
      value: this.todos.size
    };
  }

  public dispose() {
    this.emitter.dispose();
    this.fileItemCache.clear();
    this.todos.clear();
    this.view?.dispose();
  }
}