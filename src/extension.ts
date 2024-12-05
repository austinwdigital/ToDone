import * as vscode from "vscode";
import { TodoTreeProvider } from "./todoTreeProvider";
import { debounce } from "./utils";

async function openTodoLocation(todo: { filePath: string; line: number }) {
  if (!todo?.filePath) {return;}

  const doc = await vscode.workspace.openTextDocument(todo.filePath);
  const position = new vscode.Position(todo.line - 1, 0);
  await vscode.window.showTextDocument(doc, {
    selection: new vscode.Range(position, position)
  });
}

function setupFileWatchers(todoTreeProvider: TodoTreeProvider) {
  const handleFileUpdate = debounce((document: vscode.TextDocument) => {
    if (document.uri.scheme === 'file' && !document.isClosed) {
      todoTreeProvider.addTodosForFile(document.fileName, document.getText());
      todoTreeProvider.updateBadge();
    }
  }, 250);

  return [
    vscode.workspace.onDidChangeTextDocument(e => handleFileUpdate(e.document)),
    vscode.workspace.onDidOpenTextDocument(handleFileUpdate),
    vscode.workspace.onDidSaveTextDocument(handleFileUpdate)
  ];
}

export function activate(context: vscode.ExtensionContext) {
  const todoTreeProvider = new TodoTreeProvider();

  const subscriptions = [
    vscode.window.registerTreeDataProvider("todoTreeView", todoTreeProvider),
    vscode.commands.registerCommand("todoTree.openFile", openTodoLocation),
    vscode.commands.registerCommand("todoTree.refresh", () => 
      vscode.workspace.textDocuments.forEach(doc => 
        todoTreeProvider.addTodosForFile(doc.fileName, doc.getText())
      )
    ),
    ...setupFileWatchers(todoTreeProvider)
  ];

  // Initial load of open documents
  vscode.workspace.textDocuments.forEach(doc => 
    todoTreeProvider.addTodosForFile(doc.fileName, doc.getText())
  );

  context.subscriptions.push(...subscriptions);
}

export function deactivate() {
  // Cleanup will be handled by VS Code's disposal system
}