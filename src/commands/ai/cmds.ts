// Copyright(c) ZenML GmbH 2024. All Rights Reserved.
// Licensed under the Apache License, Version 2.0(the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied.See the License for the specific language governing
// permissions and limitations under the License.

import { SaveAIChangeEmitter } from '../pipelines/AIStepFixer';

const mockLog = `Step data_splitter has started.

By default, the PandasMaterializer stores data as a .csv file. If you want to store data more efficiently, you can install pyarrow by running 'pip install pyarrow'. This will allow PandasMaterializer to automatically store the data as a .parquet file instead.

Failed to run step data_splitter after 1 retries. Exiting.

You have an old version of a PandasMaterializer data artifact stored in the artifact store as a .parquet file, which requires pyarrow for reading, You can install pyarrow by running 'pip install pyarrow fastparquet'.
Traceback (most recent call last):
  File "/Users/alex/.pyenv/versions/3.9.1/lib/python3.9/site-packages/zenml/orchestrators/step_launcher.py", line 268, in launch
    self._run_step(
  File "/Users/alex/.pyenv/versions/3.9.1/lib/python3.9/site-packages/zenml/orchestrators/step_launcher.py", line 476, in _run_step
    self._run_step_without_step_operator(
  File "/Users/alex/.pyenv/versions/3.9.1/lib/python3.9/site-packages/zenml/orchestrators/step_launcher.py", line 560, in _run_step_without_step_operator
    runner.run(
  File "/Users/alex/.pyenv/versions/3.9.1/lib/python3.9/site-packages/zenml/orchestrators/step_runner.py", line 188, in run
    function_params = self._parse_inputs(
  File "/Users/alex/.pyenv/versions/3.9.1/lib/python3.9/site-packages/zenml/orchestrators/step_runner.py", line 354, in _parse_inputs
    function_params[arg] = self._load_input_artifact(
  File "/Users/alex/.pyenv/versions/3.9.1/lib/python3.9/site-packages/zenml/orchestrators/step_runner.py", line 457, in _load_input_artifact
    return materializer.load(data_type=data_type)
  File "/Users/alex/.pyenv/versions/3.9.1/lib/python3.9/site-packages/zenml/materializers/pandas_materializer.py", line 90, in load
    raise ImportError(
ImportError: You have an old version of a PandasMaterializer data artifact stored in the artifact store as a .parquet file, which requires pyarrow for reading, You can install pyarrow by running 'pip install pyarrow fastparquet'.`;

const mockSourceCode = `@step
def data_splitter(
    dataset: pd.DataFrame, test_size: float = 0.2
) -> Tuple[
    Annotated[pd.DataFrame, "raw_dataset_trn"],
    Annotated[pd.DataFrame, "raw_dataset_tst"],
]:
    """Dataset splitter step.

    This is an example of a dataset splitter step that splits the data
    into train and test set before passing it to ML model.

    This step is parameterized, which allows you to configure the step
    independently of the step code, before running it in a pipeline.
    In this example, the step can be configured to use different test
    set sizes. See the documentation for more information:

        https://docs.zenml.io/how-to/build-pipelines/use-pipeline-step-parameters

    Args:
        dataset: Dataset read from source.
        test_size: 0.0..1.0 defining portion of test set.

    Returns:
        The split dataset: dataset_trn, dataset_tst.
    """
    dataset_trn, dataset_tst = train_test_split(
        dataset,
        test_size=test_size,
        random_state=42,
        shuffle=True,
    )
    dataset_trn = pd.DataFram(dataset_trn, columns=dataset.columns)
    dataset_tst = pd.DataFrame(dataset_tst, columns=dataset.columns)
    return dataset_trn, dataset_tst`;

const mockResponse = `The error you encountered arises from the \`test\` function being called with a parameter value of \`1\`. The key part of the error message is:

\`\`\`
ValueError: The parameter passed to the test function must be any non-1 integer
\`\`\`

This error indicates that the \`test\` function has a specific requirement that it must receive a parameter that is a non-1 integer. Here are some reasons why this error could occur:

1. **Incorrect Parameter Value**: The code currently calls \`test(1)\`, which directly violates the function's parameter requirement as stated in the error message. The \`test\` function likely expects a value such that it will not be \`1\`, and passing \`1\` directly results in the error. This is the root cause of the issue.

2. **Missing Parameter Validation**: If the \`test\` function is your own implementation, it may lack proper input validation and checks that could catch such issues before they lead to errors during execution. Ensuring that conditions about parameter values are validated can simplify debugging.

### Proposed Code Changes

To resolve the error, you need to modify the value passed to the \`test\` function in the \`data_splitter\` function. Here is the revised code with the necessary change (you can change the \`1\` to any valid non-1 integer value, for example, \`2\`):

\`\`\`python
@step
def data_splitter(
    dataset: pd.DataFrame, test_size: float = 0.2
) -> Tuple[
    Annotated[pd.DataFrame, "raw_dataset_trn"],
    Annotated[pd.DataFrame, "raw_dataset_tst"],
]:
    """Dataset splitter step.

    This is an example of a dataset splitter step that splits the data
    into train and test set before passing it to ML model.

    This step is parameterized, which allows you to configure the step
    independently of the step code, before running it in a pipeline.
    In this example, the step can be configured to use different test
    set sizes. See the documentation for more information:

        https://docs.zenml.io/how-to/build-pipelines/use-pipeline-step-parameters

    Args:
        dataset: Dataset read from source.
        test_size: 0.0..1.0 defining portion of test set.

    Returns:
        The split dataset: dataset_trn, dataset_tst.
    """
    dataset_trn, dataset_tst = train_test_split(
        dataset,
        test_size=test_size,
        random_state=42,
        shuffle=True,
    )
    dataset_trn = pd.DataFrame(dataset_trn, columns=dataset.columns)
    dataset_tst = pd.DataFrame(dataset_tst, columns=dataset.columns)
    test(2)  # Updated from 1 to 2
    return dataset_trn, dataset_tst
\`\`\`

By passing \`2\` (or any other valid non-1 integer) to \`test\`, you should no longer encounter this specific error, thereby allowing the \`data_splitter\` function to execute correctly. If there are additional constraints or requirements for the \`test\` function's parameters, be sure to modify accordingly as per those guidelines.`;

import * as vscode from 'vscode';
import type { ExtensionContext } from 'vscode';
import { AIService } from '../../services/aiService';
import AIStepFixer from '../pipelines/AIStepFixer';

const sendOpenAIRequest = async (context: ExtensionContext) => {
  // Depricated command, used for testing/development
};

const displayNextCodeRecommendation = () => {
  let uri = vscode.window.activeTextEditor?.document.uri;
  if (!uri) {
    return;
  }

  const stepFixer = AIStepFixer.getInstance();
  stepFixer.updateCodeRecommendation(uri);
};

const acceptCodeRecommendation = () => {
  let doc = vscode.window.activeTextEditor?.document;
  console.log(doc?.fileName, doc?.uri.scheme);
  if (doc) {
    SaveAIChangeEmitter.fire(doc);
  }
};

export const aiCommands = {
  sendOpenAIRequest,
  displayNextCodeRecommendation,
  acceptCodeRecommendation,
};
