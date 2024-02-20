/**
  * The cli command `zenml stack get` outputs the line below: 
  * The global active stack is: 'default'
  * 'default' is the actual string we want to display in the status bar.
 */
export function parseActiveStackName(fullActiveStackText: string): string {
  const prefix = "The global active stack is: ";
  const startIndex = fullActiveStackText.indexOf(prefix);
  if (startIndex === -1) {
    return 'Error parsing stack name';
  }
  const stackNameWithQuotes = fullActiveStackText.substring(startIndex + prefix.length).trim();
  const stackName = stackNameWithQuotes.slice(1, -1);
  return stackName;
}
