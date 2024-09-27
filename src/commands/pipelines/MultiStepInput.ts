import * as vscode from 'vscode';

const InputFlowAction = {
  back: Symbol('back'),
  cancel: Symbol('cancel'),
  resume: Symbol('resume'),
};

export type InputStep = (input: MultiStepInput) => Thenable<InputStep | undefined>;

interface QuickPickParameters<T extends vscode.QuickPickItem> {
  title: string;
  step: number;
  totalSteps: number;
  items: T[];
  activeItem?: T;
  ignoreFocusOut?: boolean;
  placeholder: string;
  buttons?: vscode.QuickInputButton[];
  shouldResume: () => Thenable<boolean>;
}

interface InputBoxParameters {
  title: string;
  step: number;
  totalSteps: number;
  value: string;
  prompt: string;
  validate: (value: string) => Promise<string | undefined>;
  buttons?: vscode.QuickInputButton[];
  ignoreFocusOut?: boolean;
  placeholder?: string;
  shouldResume: () => Thenable<boolean>;
}

export default class MultiStepInput {
  static async run<T>(start: InputStep) {
    const input = new MultiStepInput();
    return input.stepThrough(start);
  }

  private current?: vscode.QuickInput;
  private steps: InputStep[] = [];

  private async stepThrough<T>(start: InputStep) {
    let step: InputStep | undefined = start;
    while (step) {
      this.steps.push(step);
      if (this.current) {
        this.current.enabled = false;
        this.current.busy = true;
      }
      try {
        step = await step(this);
      } catch (err) {
        if (err === InputFlowAction.back) {
          this.steps.pop();
          step = this.steps.pop();
        } else if (err === InputFlowAction.resume) {
          step = this.steps.pop();
        } else if (err === InputFlowAction.cancel) {
          step = undefined;
        } else {
          throw err;
        }
      }
    }
    if (this.current) {
      this.current.dispose();
    }
  }

  async showQuickPick<T extends vscode.QuickPickItem, P extends QuickPickParameters<T>>({
    title,
    step,
    totalSteps,
    items,
    activeItem,
    ignoreFocusOut,
    placeholder,
    buttons,
    shouldResume,
  }: P) {
    const disposables: vscode.Disposable[] = [];
    try {
      return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>(
        (resolve, reject) => {
          const input = vscode.window.createQuickPick<T>();
          input.title = title;
          input.step = step;
          input.totalSteps = totalSteps;
          input.ignoreFocusOut = ignoreFocusOut ?? false;
          input.placeholder = placeholder;
          input.items = items;
          if (activeItem) {
            input.activeItems = [activeItem];
          }
          input.buttons = [
            ...(this.steps.length > 1 ? [vscode.QuickInputButtons.Back] : []),
            ...(buttons || []),
          ];
          disposables.push(
            input.onDidTriggerButton(item => {
              if (item === vscode.QuickInputButtons.Back) {
                reject(InputFlowAction.back);
              } else {
                resolve(<any>item);
              }
            }),
            input.onDidChangeSelection(items => resolve(items[0])),
            input.onDidHide(() => {
              (async () => {
                reject(
                  shouldResume && (await shouldResume())
                    ? InputFlowAction.resume
                    : InputFlowAction.cancel
                );
              })().catch(reject);
            })
          );
          if (this.current) {
            this.current.dispose();
          }
          this.current = input;
          this.current.show();
        }
      );
    } finally {
      disposables.forEach(d => d.dispose());
    }
  }

  async showInputBox<P extends InputBoxParameters>({
    title,
    step,
    totalSteps,
    value,
    prompt,
    validate,
    buttons,
    ignoreFocusOut,
    placeholder,
    shouldResume,
  }: P) {
    const disposables: vscode.Disposable[] = [];
    try {
      return await new Promise<string | (P extends { buttons: (infer I)[] } ? I : never)>(
        (resolve, reject) => {
          const input = vscode.window.createInputBox();
          input.title = title;
          input.step = step;
          input.totalSteps = totalSteps;
          input.value = value || '';
          input.prompt = prompt;
          input.ignoreFocusOut = ignoreFocusOut ?? false;
          input.placeholder = placeholder;
          input.buttons = [
            ...(this.steps.length > 1 ? [vscode.QuickInputButtons.Back] : []),
            ...(buttons || []),
          ];
          let validating = validate('');
          disposables.push(
            input.onDidTriggerButton(item => {
              if (item === vscode.QuickInputButtons.Back) {
                reject(InputFlowAction.back);
              } else {
                resolve(<any>item);
              }
            }),
            input.onDidAccept(async () => {
              const value = input.value;
              input.enabled = false;
              input.busy = true;
              if (!(await validate(value))) {
                resolve(value);
              }
              input.enabled = true;
              input.busy = false;
            }),
            input.onDidChangeValue(async text => {
              const current = validate(text);
              validating = current;
              const validationMessage = await current;
              if (current === validating) {
                input.validationMessage = validationMessage;
              }
            }),
            input.onDidHide(() => {
              (async () => {
                reject(
                  shouldResume && (await shouldResume())
                    ? InputFlowAction.resume
                    : InputFlowAction.cancel
                );
              })().catch(reject);
            })
          );
          if (this.current) {
            this.current.dispose();
          }
          this.current = input;
          this.current.show();
        }
      );
    } finally {
      disposables.forEach(d => d.dispose());
    }
  }
}
