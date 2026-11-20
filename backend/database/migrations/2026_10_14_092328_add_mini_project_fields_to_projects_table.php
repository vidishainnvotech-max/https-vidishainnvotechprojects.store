<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->string('project_type')
                ->default('standard')
                ->index();

            $table->string('level')->nullable();

            $table->decimal('cut_price', 10, 2)->nullable();

            $table->decimal('offer_price', 10, 2)->nullable();

            $table->boolean('is_active')
                ->default(true)
                ->index();
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropIndex(['project_type']);
            $table->dropIndex(['is_active']);

            $table->dropColumn([
                'project_type',
                'level',
                'cut_price',
                'offer_price',
                'is_active',
            ]);
        });
    }
};
