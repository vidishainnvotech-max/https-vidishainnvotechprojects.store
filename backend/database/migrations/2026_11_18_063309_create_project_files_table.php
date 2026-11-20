<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('project_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('project_stage_id')->nullable()->constrained('project_stages')->cascadeOnDelete();
            $table->string('type', 30);
            $table->string('original_name');
            $table->string('storage_path')->unique();
            $table->unsignedBigInteger('size');
            $table->string('mime_type', 100);
            $table->char('sha256', 64);
            $table->boolean('is_active')->default(true);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['project_id', 'type', 'is_active']);
            $table->index(['project_stage_id', 'type', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_files');
    }
};
