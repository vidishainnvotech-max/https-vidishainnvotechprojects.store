<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('plans')
            ->where('code', 'C1')
            ->update([
                'description' => 'One-time payment plan with complete project source and selected learning resources.',
                'unlock_map' => json_encode([
                    [
                        'stages' => [50, 100],
                        'bundles' => [
                            'black_book',
                            'report_1',
                            'report_2',
                            'complete_project_zip',
                        ],
                    ],
                ], JSON_THROW_ON_ERROR),
                'updated_at' => now(),
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('plans')
            ->where('code', 'C1')
            ->update([
                'description' => 'One-time payment plan unlocking project stages 50%, 75%, and 100%.',
                'unlock_map' => json_encode([
                    [
                        'stages' => [50, 75, 100],
                        'bundles' => ['black_book'],
                    ],
                ], JSON_THROW_ON_ERROR),
                'updated_at' => now(),
            ]);
    }
};
