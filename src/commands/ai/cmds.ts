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

import type { ExtensionContext } from 'vscode';
import { AIService } from '../../services/aiService';

const sendOpenAIRequest = async (context: ExtensionContext) => {
  const ai = AIService.getInstance(context);

  const response = await ai.fixMyPipelineRequest(mockLog, mockSourceCode);

  console.log(response);
};

export const aiCommands = {
  sendOpenAIRequest,
};
