import React from "react";
import "../styles/TransactionProgress.css";

const TransactionProgress = ({ status, network, destinationNetwork }) => {
  const {
    status: statusCode,
    message,
    txHash,
    layerZeroLink,
    sonicTxLink,
    destinationTxLink,
    elapsedTime,
    currentStep,
    totalSteps,
    startTime,
    endTime,
  } = status;

  // Calculate elapsed time since transaction started
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    // If transaction is completed or failed, just use the final elapsed time
    if (statusCode === "completed" || statusCode === "failed") {
      if (elapsedTime) {
        setElapsed(elapsedTime);
      } else if (startTime && endTime) {
        setElapsed((endTime - startTime) / 1000);
      }
      return; // Don't start the timer
    }

    // Only start the timer if we have a start time and transaction is in progress
    if (!startTime) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const seconds = (now - startTime) / 1000;
      setElapsed(seconds);
    }, 100);

    return () => clearInterval(timer);
  }, [startTime, endTime, statusCode, elapsedTime]);

  // Determine progress percentage for the progress bar
  const progressPercentage = currentStep
    ? (currentStep / totalSteps) * 100
    : statusCode === "completed"
    ? 100
    : statusCode === "failed"
    ? 100
    : Math.min((elapsed / 60) * 100, 99); // Max 99% until complete

  // Stage labels
  const getStepLabel = (step) => {
    switch (step) {
      case 1:
        return `Confirm on ${network?.name}`;
      case 2:
        return "Process on Sonic";
      case 3:
        return `Deliver to ${destinationNetwork?.name}`;
      default:
        return "Processing";
    }
  };

  return (
    <div className="transaction-progress">
      <h3>Transaction Progress</h3>

      {/* Progress bar */}
      <div className="progress-container">
        <div
          className={`progress-bar ${statusCode === "failed" ? "error" : ""}`}
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>

      {/* Progress stages */}
      {currentStep && totalSteps && (
        <div className="progress-steps">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`progress-step ${i + 1 <= currentStep ? "active" : ""} ${
                i + 1 < currentStep ? "completed" : ""
              }`}
            >
              <div className="step-icon">{i + 1}</div>
              <div className="step-label">{getStepLabel(i + 1)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Status message */}
      <div className="status-message">
        <p>{message}</p>
        {elapsed > 0 && (
          <p className="elapsed-time">
            Time elapsed: {Math.floor(elapsed / 60)}m {Math.floor(elapsed % 60)}s
          </p>
        )}
      </div>

      {/* Links */}
      {(txHash || layerZeroLink || sonicTxLink || destinationTxLink) && (
        <div className="transaction-links">
          {/* Source chain explorer link */}
          {txHash && network?.blockExplorerUrl && (
            <a href={`${network?.blockExplorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
              View on {network?.name} Explorer
            </a>
          )}

          {/* LayerZero transaction link */}
          {layerZeroLink && (
            <a href={layerZeroLink} target="_blank" rel="noopener noreferrer">
              View on LayerZero Explorer
            </a>
          )}

          {/* Sonic (intermediate) transaction link */}
          {sonicTxLink && (
            <a href={sonicTxLink} target="_blank" rel="noopener noreferrer">
              View Sonic Transaction
            </a>
          )}

          {/* Destination transaction link */}
          {destinationTxLink && (
            <a href={destinationTxLink} target="_blank" rel="noopener noreferrer">
              View Destination Transaction
            </a>
          )}
        </div>
      )}

      {/* Spinner animation */}
      {statusCode !== "completed" && statusCode !== "failed" && <div className="loading-spinner"></div>}
    </div>
  );
};

export default TransactionProgress;
