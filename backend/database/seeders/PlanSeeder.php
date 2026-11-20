<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'name' => 'A4',
                'code' => 'A4',
                'description' => 'Four-installment plan with progressive project stage access.',
                'price' => 15000,
                'installments' => 4,
                'unlock_map' => [
                    ['stages' => [20]],
                    ['stages' => [50]],
                    ['stages' => [75]],
                    ['stages' => [100], 'bundles' => ['black_book']],
                ],
                'is_active' => true,
            ],
            [
                'name' => 'B2',
                'code' => 'B2',
                'description' => 'Two-installment plan with progressive project stage access.',
                'price' => 14000,
                'installments' => 2,
                'unlock_map' => [
                    ['stages' => [20, 50]],
                    ['stages' => [75, 100], 'bundles' => ['black_book']],
                ],
                'is_active' => true,
            ],
            [
                'name' => 'C1',
                'code' => 'C1',
                'description' => 'One-time payment plan with all project stages, complete project source, and selected learning resources.',
                'price' => 13000,
                'installments' => 1,
                'unlock_map' => [
                    [
                        'stages' => [20, 50, 75, 100],
                        'bundles' => [
                            'black_book',
                            'report_1',
                            'report_2',
                            'complete_project_zip',
                        ],
                    ],
                ],
                'is_active' => true,
            ],
            [
                'name' => 'ADDON',
                'code' => 'ADDON',
                'description' => 'Optional semester 1 document bundle. Availability requires confirmation.',
                'price' => 2000,
                'installments' => 1,
                'unlock_map' => [
                    ['bundles' => ['semester_1_documents']],
                ],
                'is_active' => false,
            ],
        ];

        foreach ($plans as $planData) {
            Plan::updateOrCreate(
                ['code' => $planData['code']],
                $planData
            );
        }

        Plan::where('code', 'A4-TEST')->update([
            'is_active' => false,
        ]);

        Plan::where('code', 'D100')->update([
            'is_active' => false,
        ]);
    }
}
