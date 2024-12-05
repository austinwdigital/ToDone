import * as assert from 'assert';
import * as vscode from 'vscode';
import { TodoTreeProvider } from '../todoTreeProvider';

suite('TODO Tree Extension Test Suite', () => {
  let todoTreeProvider: TodoTreeProvider;

  setup(() => {
    todoTreeProvider = new TodoTreeProvider();
  });

  teardown(() => {
    todoTreeProvider.dispose();
  });

  test('Parses different TODO formats', () => {
    const mockText = `
      // TODO: Format 1
      // FIXME: Format 2
      // Todo - Format 3
      # TODO: Format 4
      # FIXME - Format 5
    `;
    todoTreeProvider.addTodosForFile('test.ts', mockText);
    assert.strictEqual(todoTreeProvider.getTotalTodos(), 5);
  });

  test('Updates existing TODOs on file change', () => {
    todoTreeProvider.addTodosForFile('test.ts', '// TODO: Old todo');
    assert.strictEqual(todoTreeProvider.getTotalTodos(), 1);

    todoTreeProvider.addTodosForFile('test.ts', '// TODO: New todo');
    assert.strictEqual(todoTreeProvider.getTotalTodos(), 1);
  });

  test('Handles empty files', () => {
    todoTreeProvider.addTodosForFile('empty.ts', '');
    assert.strictEqual(todoTreeProvider.getTotalTodos(), 0);
  });

  test('Maintains todo order by line number', async () => {
    const mockText = `
      // TODO: First
      code...
      // TODO: Second
      code...
      // TODO: Third
    `;
    todoTreeProvider.addTodosForFile('test.ts', mockText);
    
    const fileNodes = await todoTreeProvider.getChildren();
    const todos = await todoTreeProvider.getChildren(fileNodes[0]);
    
    // Skip path item
    assert.strictEqual(todos[1].label, 'First');
    assert.strictEqual(todos[2].label, 'Second');
    assert.strictEqual(todos[3].label, 'Third');
  });
});
