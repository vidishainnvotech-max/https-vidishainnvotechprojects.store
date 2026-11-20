<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('mobile')->unique()->after('email');
            $table->string('college_id')->after('mobile');
            $table->string('role')->default('student')->after('college_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['mobile']);
            $table->dropColumn(['mobile', 'college_id', 'role']);
        });
    }
};
