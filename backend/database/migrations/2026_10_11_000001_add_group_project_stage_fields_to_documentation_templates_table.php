<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documentation_templates', function (Blueprint $table) {
            $table->foreignId('group_id')
                ->nullable()
                ->after('college_id')
                ->constrained('groups')
                ->nullOnDelete();

            $table->foreignId('project_id')
                ->nullable()
                ->after('group_id')
                ->constrained('projects')
                ->nullOnDelete();

            $table->unsignedInteger('stage_percent')
                ->nullable()
                ->after('project_id');

            $table->string('bundle', 100)
                ->nullable()
                ->after('stage_percent');

            $table->index(
                ['project_id', 'stage_percent'],
                'documentation_templates_project_stage_index'
            );

            $table->index(
                ['group_id', 'is_active'],
                'documentation_templates_group_active_index'
            );
        });
    }

    public function down(): void
    {
        Schema::table('documentation_templates', function (Blueprint $table) {
            $table->dropIndex('documentation_templates_project_stage_index');
            $table->dropIndex('documentation_templates_group_active_index');

            $table->dropConstrainedForeignId('group_id');
            $table->dropConstrainedForeignId('project_id');
            $table->dropColumn(['stage_percent', 'bundle']);
        });
    }
};
