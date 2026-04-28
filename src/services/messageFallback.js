export const isNotFoundError = (error) => Number(error?.response?.status) === 404;

export const runFallbackSequence = async ({
  steps = [],
  isRetryable = isNotFoundError,
  onStepFailure = () => {},
}) => {
  let lastError = null;

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (typeof step?.run !== "function") continue;

    try {
      return await step.run();
    } catch (error) {
      lastError = error;
      const retryable = Boolean(isRetryable(error));
      onStepFailure({
        name: step?.name || `step-${index + 1}`,
        index,
        error,
        retryable,
      });
      if (!retryable) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
};
