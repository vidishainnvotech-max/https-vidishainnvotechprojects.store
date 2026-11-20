<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Plan;

class PlanController extends Controller
{
    public function index()
    {
        $plans = Plan::query()
            ->where('is_active', true)
            ->whereNotIn('code', ['A4-TEST', 'ADDON', 'D100'])
            ->orderBy('price')
            ->get([
                'id',
                'name',
                'code',
                'description',
                'price',
                'installments',
                'unlock_map',
                'is_active',
            ]);

        return response()->json($plans);
    }
}
