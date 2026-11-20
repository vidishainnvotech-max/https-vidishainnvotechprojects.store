<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_bundle_access', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('bundle', 100);
            $table->timestamps();

            $table->unique(
                ['user_id', 'project_id', 'bundle'],
                'user_bundle_access_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_bundle_access');
    }
};
