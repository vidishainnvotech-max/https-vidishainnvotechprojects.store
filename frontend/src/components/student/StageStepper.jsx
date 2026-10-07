import { Check, LockKeyhole } from "lucide-react";

const STAGES = [20, 50, 75, 100];

function StageStepper({ userAccess = [], currentStage = 0 }) {
  return (
    <div className="stage-stepper">
      {STAGES.map((percent) => {
        const unlocked = userAccess.some(
          (access) => Number(access.stage_percent) === percent,
        );

        const completed = unlocked && percent < Number(currentStage);
        const current = percent === Number(currentStage);

        return (
          <div
            key={percent}
            className={`stage-stepper__item ${
              unlocked ? "is-unlocked" : "is-locked"
            } ${completed ? "is-completed" : ""} ${
              current ? "is-current" : ""
            }`}
          >
            <div className="stage-stepper__marker">
              {completed ? (
                <Check size={16} aria-hidden="true" />
              ) : unlocked ? (
                percent
              ) : (
                <LockKeyhole size={14} aria-hidden="true" />
              )}
            </div>

            <div className="stage-stepper__content">
              <strong>Stage {percent}%</strong>
              <span>
                {completed ? "Completed" : current ? "Current" : unlocked ? "Unlocked" : "Locked"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default StageStepper;
