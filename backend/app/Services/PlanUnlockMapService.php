<?php

namespace App\Services;

use RuntimeException;

class PlanUnlockMapService
{
    private const ALLOWED_STAGES = [20, 50, 75, 100];

    public function forInstallment(
        ?array $unlockMap,
        int $installmentNo
    ): array {
        if (empty($unlockMap) || $installmentNo < 1) {
            throw new RuntimeException(
                'This plan does not have a valid unlock map.'
            );
        }

        if (array_is_list($unlockMap)) {
            $rule = $unlockMap[$installmentNo - 1] ?? null;
        } else {
            $rule = $unlockMap[(string) $installmentNo]
                ?? $unlockMap[$installmentNo]
                ?? null;
        }

        if ($rule === null) {
            throw new RuntimeException(
                "No unlock configuration exists for installment {$installmentNo}."
            );
        }

        if (is_numeric($rule)) {
            $rule = [
                'stages' => [(int) $rule],
                'bundles' => [],
            ];
        }

        if (! is_array($rule)) {
            throw new RuntimeException(
                "Invalid unlock configuration for installment {$installmentNo}."
            );
        }

        $stages = $rule['stages'] ?? [];
        $bundles = $rule['bundles'] ?? [];

        if (! is_array($stages) || ! is_array($bundles)) {
            throw new RuntimeException(
                "Invalid stages or bundles for installment {$installmentNo}."
            );
        }

        foreach ($stages as $stage) {
            if (
                ! is_numeric($stage)
                || ! in_array((int) $stage, self::ALLOWED_STAGES, true)
                || (float) $stage !== (float) (int) $stage
            ) {
                throw new RuntimeException(
                    "Invalid stage percentage in installment {$installmentNo}."
                );
            }
        }

        foreach ($bundles as $bundle) {
            if (
                ! is_string($bundle)
                || ! preg_match('/^[a-z][a-z0-9_]*$/', $bundle)
            ) {
                throw new RuntimeException(
                    "Invalid document bundle in installment {$installmentNo}."
                );
            }
        }

        return [
            'stages' => array_values(array_unique(array_map(
                'intval',
                $stages
            ))),
            'bundles' => array_values(array_unique($bundles)),
        ];
    }

    public function validate(
        ?array $unlockMap,
        int $installments
    ): void {
        if (
            ! in_array($installments, [1, 2, 4], true)
            || ! is_array($unlockMap)
            || count($unlockMap) !== $installments
        ) {
            throw new RuntimeException(
                'Invalid payment plan configuration: unlock rules must match the installment count.'
            );
        }

        for ($number = 1; $number <= $installments; $number++) {
            $this->forInstallment($unlockMap, $number);
        }
    }
}
